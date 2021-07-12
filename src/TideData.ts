import axios from 'axios';
import dateformat from 'dateformat';

export class TideData {

    private logger;

    constructor(logger: any) {
        this.logger = logger;
    }    

    public async getTideData(station, application) {
        const today = new Date();
        const beginDateStr = dateformat(today, "yyyymmdd%2000:00");
        const endDateStr = dateformat(today, "yyyymmdd%2023:54");

        const url: string = `https://tidesandcurrents.noaa.gov/api/datagetter?begin_date=${beginDateStr}&end_date=${endDateStr}&station=${station}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&application=${application}&format=json`;
        // this.logger.log(url);

        // {
        //     "predictions": [
        //         {   "t": "2021-07-11 00:00", "v": "3.362" },
        //         {   "t": "2021-07-11 00:06", "v": "3.542" },
        //         ...
        //     ]
        // }

        let tideJson: Array<object> = [];
        await axios.get(url)
            .then((response: any) => {
                tideJson = response.data.predictions;
            })
            .catch((error: any) => {
                this.logger.error("TideData: Error getting time data: " + error);
            });
        
        return tideJson;
    }
}