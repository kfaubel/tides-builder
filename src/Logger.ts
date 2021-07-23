"use strict";

export class Logger {
    private module: string;
    private level: number = 2;
    private _VERBOSE: number = 0;
    private _DEBUG: number   = 1;
    private _INFO: number    = 2;
    private _WARN: number    = 3;
    private _ERROR: number   = 4;

    constructor(module: string, levelStr: string = "info") {
        this.module = module;

        switch (levelStr) {
            case "error":   this.level = this._ERROR; break;
            case "warn":    this.level = this._WARN; break;
            case "info":    this.level = this._INFO; break;
            case "debug":   this.level = this._DEBUG; break;
            case "verbose": this.level = this._VERBOSE; break;
            case "trace":   this.level = this._VERBOSE; break;
            default: console.log(`Unexpected level: ${levelStr}, using warn`);
        }
    }

    public error(text: string) {
        if (this.level <= this._ERROR) return;
            console.error(`[${this.module} E] ${text}`);
        }

    public warn(text: string) {
        if (this.level <= this._WARN) {
            console.log(`[${this.module} W] ${text}`);
        } 
    }

    public log(text: string) {
        if (this.level <= this._INFO) {
            console.log(`[${this.module} I] ${text}`);
        } 
    }

    public info(text: string) {
        if (this.level <= this._INFO) {
            console.log(`[${this.module} I] ${text}`);
        } 
    }

    public verbose(text: string) {
        if (this.level <= this._VERBOSE) {
            console.log(`[${this.module} V] ${text}`);
        } 
    }

    public trace(text: string) {
        if (this.level <= this._VERBOSE) return;
        console.debug(`[${this.module} V] ${text}`);
    }
}