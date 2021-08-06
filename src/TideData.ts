import axios, { AxiosResponse } from "axios";
import dateformat from "dateformat";
import { Logger as LoggerInterface } from "./Logger";
import { Kache as KacheInterface } from "./Kache";

export interface Prediction {
    t: string;
    v: string;
}

export class TideData {

    private logger: LoggerInterface;
    private cache: KacheInterface;

    constructor(logger: LoggerInterface, cache: KacheInterface) {
        this.logger = logger;
        this.cache = cache;
    }    

    public async getTideData(station: string, application: string): Promise<Array<Prediction> | null> {
        const today = new Date();
        const beginDateStr = dateformat(today, "yyyymmdd%2000:00");
        const endDateStr = dateformat(today, "yyyymmdd%2023:54");

        const url = `https://tidesandcurrents.noaa.gov/api/datagetter?begin_date=${beginDateStr}&end_date=${endDateStr}&station=${station}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&application=${application}&format=json`;
        // this.logger.log(url);

        // {
        //     "predictions": [
        //         {   "t": "2021-07-11 00:00", "v": "3.362" },
        //         {   "t": "2021-07-11 00:06", "v": "3.542" },
        //         ...
        //     ]
        // }

        let tideJson: Array<Prediction> | null = this.cache.get(station) as Array<Prediction>;
        if (tideJson === null) {
            try {
                this.logger.verbose("getTideData: Fetching today's tide data");
                const response: AxiosResponse = await axios.get(url, {headers: {"Content-Encoding": "gzip"}});
                tideJson = response.data.predictions;

                if (tideJson !== undefined) {
                    const midnightTonight: Date = new Date();
                    midnightTonight.setHours(23,59,59,0);

                    this.cache.set(station, tideJson, midnightTonight.getTime() );
                } else {
                    tideJson = null;
                }
                
            } catch(e) {
                this.logger.error(`TideData: Error getting time data: ${e}`);
                tideJson = null;
            }
        }
        
        return tideJson;
    }
}