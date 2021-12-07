import axios, { AxiosResponse } from "axios";
import dateformat from "dateformat";
import moment from "moment-timezone";
import { LoggerInterface } from "./Logger";
import { KacheInterface } from "./Kache";

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

    /**
     * 
     * @param station - NOAA station id
     * @param timeZone e.g.: "America/New_York"
     * @param application - idnetifier for the REST call to NOAA
     * @returns 
     */
    public async getTideData(station: string, timeZone: string, application: string): Promise<Array<Prediction> | null> {
        const now: moment.Moment = moment();
        const beginDateStr = now.tz(timeZone).format("YYYYMMDD%2000:00");
        const endDateStr   = now.tz(timeZone).format("YYYYMMDD%2023:54");

        const url = `https://tidesandcurrents.noaa.gov/api/datagetter?begin_date=${beginDateStr}&end_date=${endDateStr}&station=${station}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&application=${application}&format=json`;
        this.logger.log(url);

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
                //this.logger.verbose("getTideData: Fetching today's tide data");
                const response: AxiosResponse = await axios.get(url, {headers: {"Content-Encoding": "gzip"}, timeout: 2000});
                tideJson = response.data.predictions;

                if (tideJson !== undefined) {
                    // create a date in the specified timezone for the end of day
                    const midnightTonight = moment().tz(timeZone).endOf("day");

                    // Key: station, Value: tideJson, expiration (seconds)
                    this.cache.set(station, tideJson, midnightTonight.valueOf() );
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