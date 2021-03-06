import { autoinject, LogManager } from "aurelia-framework";
import * as moment from "moment";
import { TrackItemService } from "../services/track-item-service";
import { SettingsService } from "../services/settings-service";
import { DialogService } from 'aurelia-dialog';

import { ValidationController, ValidationRules, ValidationControllerFactory, validateTrigger } from 'aurelia-validation';
import { BootstrapFormRenderer } from "resources/bootstrap-form-renderer";

let logger = LogManager.getLogger('Menubar');

const ipcRenderer = (<any>window).nodeRequire('electron').ipcRenderer;

@autoinject
export class Menubar {
    trackItems: Array<any> = [];

    loading: boolean = false;

    newItem: any = { color: '#426DFC' };
    runningLogItem: any;
    validationController: ValidationController;

    constructor(private trackItemService: TrackItemService, private settingsService: SettingsService,
        private dialogService: DialogService, private controllerFactory: ValidationControllerFactory,
    ) {

        this.validationController = controllerFactory.createForCurrentScope();
        this.validationController.addRenderer(new BootstrapFormRenderer());
        this.validationController.validateTrigger = validateTrigger.blur;
    }


    async activate(): Promise<void> {
        this.refresh();
        ipcRenderer.on('focus-tray', () => this.refresh());
        this.setValidationRules();
    }

    loadItems() {
        logger.debug("Loading items");
        logger.debug("Loading items", this.trackItemService.findFirstLogItems());
        this.loading = true;
        this.trackItemService.findFirstLogItems().then((items) => {
            logger.debug("Loaded items", items);
            items.forEach(function (item) {
                item.timeDiffInMs = moment(item.endDate).diff(item.beginDate);
                item.duration = moment.duration(item.endDate - item.beginDate);
            });
            this.trackItems = items;
            this.loading = false;
        }, (err) => { logger.error(err) });
    }

    setValidationRules() {
        logger.debug("Setting validation rules, for:", this.newItem);
        ValidationRules
            .ensure('app').required()
            .ensure('title').required()
            .on(this.newItem);
    }

    startNewLogItem(oldItem: any) {
        this.newItem = oldItem;
        this.validationController.validate().then(v => {
            if (v.valid) {
                this.stopRunningLogItem();
                this.trackItemService.startNewLogItem(this.newItem).then((item) => {
                    logger.debug("Setting running log item:", item);
                    this.runningLogItem = item;
                })
            } else {
                logger.error("Not Valid", v)
            }
        });

    }

    stopRunningLogItem() {
        if (this.runningLogItem && this.runningLogItem.id) {

            this.trackItemService.stopRunningLogItem(this.runningLogItem.id).then(() => {
                this.runningLogItem = null;
                this.loadItems();
            })
        } else {
            console.debug("No running log item");
        }
    }

    refresh() {
        console.log("Refresh data");

        this.settingsService.getRunningLogItem().then((item) => {
            console.log("Running log item:", item);
            this.runningLogItem = item;
        });

        this.loadItems();
    };
}
