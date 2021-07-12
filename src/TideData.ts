import convert from 'xml-js';
import axios from 'axios';
import dateformat from 'dateformat';

//const convert = require('xml-js');
//const axios = require('axios');

// Onset" https://forecast.weather.gov/MapClick.php?lat=41.7476&lon=-70.6676&FcstType=digitalDWML
// NOLA   https://forecast.weather.gov/MapClick.php?lat=29.9537&lon=-90.0777&FcstType=digitalDWML

// New data source : https://www.weather.gov/documentation/services-web-api
// Not all data is present

export class TideData {

    private logger;

    constructor(logger: any) {
        this.logger = logger;
    }    

    // station = "8447270";
    public async getTideData(station) {

        const today = new Date();
        const beginDateStr = dateformat(today, "yyyymmdd%2000:00");
        const endDateStr = dateformat(today, "yyyymmdd%2023:54");
        
        const application = "ken@faubel.org";

        const url = `https://tidesandcurrents.noaa.gov/api/datagetter?begin_date=${beginDateStr}&end_date=${endDateStr}&station=${station}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&application=${application}&format=json`;
        
        // {
        //     "predictions": [
        //         {
        //             "t": "2021-07-11 00:00",
        //             "v": "3.362"
        //         },
        //         {
        //             "t": "2021-07-11 00:06",
        //             "v": "3.282"
        //         },
        //         ...
        //     ]
        // }
        this.logger.log(url);

        let tideJson: Array<object> = [];
        await axios.get(url)
            .then((response: any) => {
                // handle success
                //this.logger.log(response.data);
                tideJson = response.data.predictions;
                //this.logger.log(`TideData: GET result: ${JSON.stringify(tideJson, null, 4)}`);
                
            })
            .catch((error: any) => {
                // handle error
                // tslint:disable-next-line:no-console
                this.logger.error("TideData: Error getting time data: " + error);
            });
        
        return tideJson;
    }
}