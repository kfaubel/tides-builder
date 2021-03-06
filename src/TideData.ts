import axios, { AxiosResponse, AxiosRequestConfig, AxiosError } from "axios";
import moment from "moment-timezone";  // https://momentjs.com/timezone/docs/ &  https://momentjs.com/docs/
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
     * Builds a URL and fetches tide data.
     * @param station - NOAA station id
     * @param timeZone e.g.: "America/New_York"
     * @param application - idnetifier for the REST call to NOAA
     * @returns Array of Predicitons data {t: <time>, v: <height>} for every 6 minute for the current day in timeZone
     */
    public async getTideData(station: string, timeZone: string, application: string): Promise<Array<Prediction> | null> {
        const now: moment.Moment = moment();
        const beginDateStr = now.tz(timeZone).format("YYYYMMDD%2000:00");
        const endDateStr   = now.tz(timeZone).format("YYYYMMDD%2023:54");

        // {
        //     "predictions": [
        //         {   "t": "2021-07-11 00:00", "v": "3.362" },
        //         {   "t": "2021-07-11 00:06", "v": "3.542" },
        //         ...
        //     ]
        // }

        let tideJson: Array<Prediction> | null = this.cache.get(station) as Array<Prediction>;
        if (tideJson === null) {
            const url = `https://tidesandcurrents.noaa.gov/api/datagetter?begin_date=${beginDateStr}&end_date=${endDateStr}&station=${station}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&application=${application}&format=json`;
            this.logger.verbose(url);
            
            try {           
                const options: AxiosRequestConfig = {
                    headers: {
                        "Content-Encoding": "gzip"
                    },
                    timeout: 5000
                };

                const startTime = new Date();
                await axios.get(url, options)
                    .then((response: AxiosResponse) => {
                        if (typeof process.env.TRACK_GET_TIMES !== "undefined" ) {
                            this.logger.info(`TideData: GET TIME: ${new Date().getTime() - startTime.getTime()}ms`);
                        }
                        tideJson = response.data.predictions;
                    })
                    .catch((error: AxiosError) => {
                        this.logger.warn(`TideData: GET error: ${error}`);
                        tideJson = null;
                    }); 

                if (tideJson !== undefined  && tideJson !== null) {
                    // create a date in the specified timezone for the end of day
                    const midnightTonight = moment().tz(timeZone).endOf("day");

                    // Key: station, Value: tideJson, expiration (seconds)
                    this.cache.set(station, tideJson, midnightTonight.valueOf() );
                } 
                
            } catch(e) {
                this.logger.warn(`TideData: Exception getting data: ${e}`);
                tideJson = null;
            }
        }
        
        return tideJson;
    }
}