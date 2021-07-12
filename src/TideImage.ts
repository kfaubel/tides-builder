import stream from 'stream';
import jpeg from 'jpeg-js';
//import {pure from 'pureimage';
const pure = require('pureimage');

import { TideData } from './TideData';
import { createGzip } from 'zlib';
const fontDir = __dirname + "/../fonts";

export class TideImage {
    private tideData: any;

    private logger;

    constructor(logger: any) {
        this.logger = logger;
    }

    public setLogger(logger: any) {
        this.logger = logger;
    }

    public async getImageStream(station: string) {
        this.logger.info(`TideImage: request for ${station}`);

        const title = "Forecast for Onset, MA";
        
        this.tideData = new TideData(this.logger);

        interface Prediction {
            t: number;
            v: number;
        }

        const predictionsArray: Array<Prediction> = await  this.tideData.getTideData(station);

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

        if (predictionsArray === undefined) {
            this.logger.warn("TideImage: Failed to get data, no image available.\n")
            return null;
        }

        const imageHeight: number = 1080; // 800;
        const imageWidth: number  = 1920; // 1280;

        // Screen origin is the upper left corner
        // Java Canvas: origin is upper left.  positive number to the right and down.
        const  chartOriginX = 100;                    // In from the left edge
        const  chartOriginY = imageHeight - 70;       // Down from the top (Was: Up from the bottom edge)

        const verticalGridLineCount = 24;    // Plus a line at 0, vertical line at each hour
        let horizontalGridLineCount = 9;     // Plus a line at -1 and 0. horizontal line at each 1ft marker
        const verticalGridLineSpacing = 70;  // 70 * 24 = 1680 pixels wide, should be a multiple of 10 since 10 data points/hour
        let  horizontalGridSpacing = 100;    // 110 * 8 = 880 pixels tall

        let   pixelsPerTideLevel = 110;      // Normally is 1ft is 100pts (could scale to 2ft is 100pts), Same as horizontalGridSpacing!
        const pixelsPerDataPoint = 7;        // 7 pixels each prediction sample
        const dataPointsPerHour  = 10;       // There are 10 predictions per hour, every 6 minutes.
        const pixelsPerHour      = pixelsPerDataPoint * dataPointsPerHour;  // 70,  Same as verticalGridLineSpacing!

        // The chartWidth will be smaller than the imageWidth but must be a multiple of hoursToShow
        // The chartHeight will be smaller than the imageHeight but must be a multiple of 100
        const  chartWidth  = verticalGridLineCount   * verticalGridLineSpacing; // 24 * 70 = 1680
        let  chartHeight = horizontalGridLineCount * horizontalGridSpacing;   // 8 * 110 = 880
        

        // const topLegendLeftIndent = imageWidth - 300;

        const backgroundColor: string     = 'rgb(240, 240, 255)';
        const titleColor: string          = 'rgb(0,   0,   150)';
        const gridLinesColor: string      = 'rgb(100, 100, 100)';
        const majorGridLinesColor: string = 'rgb(150, 150, 150)';
        const tideColor: string           = 'rgba(0,  50,   150, 0.7)';

        const largeFont: string  = "48px 'OpenSans-Bold'";   // Title
        const mediumFont: string = "36px 'OpenSans-Bold'";   // axis labels
        const smallFont: string  = "24px 'OpenSans-Bold'";   // Legend at the top

        const fntBold     = pure.registerFont(fontDir + '/OpenSans-Bold.ttf','OpenSans-Bold');
        const fntRegular  = pure.registerFont(fontDir + '/OpenSans-Regular.ttf','OpenSans-Regular');
        const fntRegular2 = pure.registerFont(fontDir + '/alata-regular.ttf','alata-regular');

        fntBold.loadSync();
        fntRegular.loadSync();
        fntRegular2.loadSync();

        const thinStroke: number = 1;
        const regularStroke: number = 3;
        const heavyStroke: number = 5;

        

        // Get the min and max tide levels
        let maxLevel = 0.0;
        let minLevel = 0.0;

        for (let prediction of predictionsArray) {
            // this.logger.log(`Prediction: ${prediction}`);
            // this.logger.log(`Level: ${prediction.v}, Time: ${prediction.t}`)
            const tideLevel = prediction.v;

            if (tideLevel > maxLevel)
                maxLevel = tideLevel;

            if (tideLevel < minLevel)
                minLevel = tideLevel;
        }

        if (maxLevel < 8) {
            horizontalGridLineCount = 9;  // Default form above <-- fix for 
            horizontalGridSpacing  = 100; // default from above,  Chart
        } else if (maxLevel < 12) {
            horizontalGridLineCount = 12;
            horizontalGridSpacing  = 50; // 650
        } else if (maxLevel < 16) {
            horizontalGridLineCount = 17;
            horizontalGridSpacing  = 38; // 646
        } else if (maxLevel < 20) {
            horizontalGridLineCount = 21;
            horizontalGridSpacing  = 30; // 630
        } else if (maxLevel < 28) {
            horizontalGridLineCount = 29;
            horizontalGridSpacing  = 22; // 638
        } else {
            horizontalGridLineCount = 41;
            horizontalGridSpacing  = 16; // 656
        }

        chartHeight = horizontalGridLineCount * horizontalGridSpacing; 

        this.logger.log(`MaxLevel: ${maxLevel}, Horizontal Grid Spacing: ${horizontalGridSpacing}, count ${horizontalGridLineCount}`)

        const img = pure.make(imageWidth, imageHeight);
        const ctx = img.getContext('2d');

        // Canvas reference
        // origin is upper right
        // coordinates are x, y, width, height in that order
        // to set a color: ctx.fillStyle = 'rgb(255, 255, 0)'
        //                 ctx.fillStyle = 'Red'
        //                 ctx.setFillColor(r, g, b, a);
        //                 ctx.strokeStyle = 'rgb(100, 100, 100)';


        // Fill the bitmap
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, imageWidth, imageHeight);

        // Draw the title
        ctx.fillStyle = titleColor;
        ctx.font = largeFont;
        const textWidth: number = ctx.measureText(title).width;
        ctx.fillText(title, (imageWidth - textWidth) / 2, 60);


        // Draw the labels on the Y axis
        //p.setStrokeWidth(1f);
        //p.setTextSize(24);
        // canvas.drawText(timeStr, 512 - bounds.width()/2, 300, p);

        // Label every foot unless there are more than 20 ft, then label every other one
        let labelStep = 1;
        if (horizontalGridSpacing < 32)
            labelStep = 2;

        // canvas.drawText(Integer.toString(-1), originX - 50, originY + 10 - (0 * horizontalGridSpacing), p);
        // for (int i = 0; i < horizontalridLineCount; i += labelStep) {
        //     canvas.drawText(Integer.toString(i), originX - 50, originY + 10 - ((i + 1) * horizontalGridSpacing), p);
        // }


        
        // Draw the labels on the X axis
        for (let hour = 0; hour <= 24; hour += 3) {
            let label;
            if (hour == 0 || hour == 24) {
                label = "12 AM";
            } else if (hour > 12) {
                label = `${hour - 12}`
            } else {
                label = `${hour}`;
            }

            const textWidth: number = ctx.measureText(label).width;
            ctx.fillText(label, (chartOriginX + (hour * verticalGridLineSpacing)) - textWidth/2, chartOriginY + 60);

        }

        // Draw the regular vertical lines
        ctx.strokeStyle = gridLinesColor;
        ctx.lineWidth = regularStroke;
        for (let i: number = 0; i <= verticalGridLineCount; i++) {
            const startX = chartOriginX + (i * verticalGridLineSpacing);
            const endX = chartOriginX + (i * verticalGridLineSpacing);
            const startY = chartOriginY;
            const endY = chartOriginY - (chartHeight);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        const verticalMajorGridLineCount = 2;  // 0, 12 and 24 hours
        const verticalMajorGridSpacing = (verticalGridLineSpacing * 12);  // every 12 hours
        // Draw the major vertical lines
        ctx.strokeStyle = majorGridLinesColor;
        ctx.lineWidth = heavyStroke;
        for (let i: number = 0; i <= verticalMajorGridLineCount; i ++) {
            const startX = chartOriginX + (i * verticalMajorGridSpacing);
            const endX   = chartOriginX + (i * verticalMajorGridSpacing);
            const startY = chartOriginY;
            const endY   = chartOriginY - (chartHeight);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }


 
        // Draw the horizontal grid lines 
        ctx.strokeStyle = gridLinesColor;
        ctx.lineWidth = regularStroke;
        for (let i: number = 0; i <= horizontalGridLineCount; i++) {
            const startX = chartOriginX;
            const endX   = chartOriginX + chartWidth;
            const startY = chartOriginY - (i * horizontalGridSpacing);
            const endY   = chartOriginY - (i * horizontalGridSpacing);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Draw the major horizontal lines
        const horizontalMajorGridLineCount = 1;
        const horizontalMajorGridSpacing = chartHeight;
        ctx.strokeStyle = majorGridLinesColor;
        ctx.lineWidth = heavyStroke;
        for (let i: number = 0; i <= horizontalMajorGridLineCount; i++) {
            const startX = chartOriginX;
            const endX   = chartOriginX + chartWidth;
            const startY = chartOriginY - (i * horizontalMajorGridSpacing);
            const endY   = chartOriginY - (i * horizontalMajorGridSpacing);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }


        // Draw the water level area
        // Set alpha 

        // Start at chart origin
        ctx.fillStyle = tideColor;
        ctx.beginPath();
        ctx.moveTo(chartOriginX, chartOriginY);
        
        // drawto each data point
        let x = chartOriginX;
        for (let prediction of predictionsArray) {
            //this.logger.log(`Prediction: ${prediction}`);
            //this.logger.log(`Level: ${prediction.v}, Time: ${prediction.t}`)

            ctx.lineTo(x, chartOriginY - (prediction.v * pixelsPerTideLevel) );
            x += pixelsPerDataPoint;
        }

        ctx.lineTo(chartOriginX + chartWidth, chartOriginY);
        ctx.lineTo(chartOriginX, chartOriginY);
        ctx.fill();

        


        // // Draw the line at the current time
        // Calendar rightNow = Calendar.getInstance();
        // int hour = rightNow.get(Calendar.HOUR_OF_DAY);
        // int minute = rightNow.get(Calendar.MINUTE);

        // p.setStrokeWidth(4f);
        // p.setColor(Color.RED);
        // int timeX = originX + (Line * (hour * 60 + minute))/60;
        // canvas.drawLine(timeX, originY, timeX, originY - (horizontalridLineCount * horizontalGridSpacing), p);

        // Date now = new Date();
        // String timeStr = new SimpleDateFormat("h:mm a").format(now);
        // //p.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
        // p.setColor(Color.argb(255, 0,0,255));
        // p.setTextSize(32);
        // //canvas.drawText(timeStr, width - 180, height - 20, p);

        const expires = new Date();
        expires.setHours(expires.getHours() + 2);

        const jpegImg = await jpeg.encode(img, 50);

        const jpegStream = new stream.Readable({
            read() {
                this.push(jpegImg.data);
                this.push(null);
            }
        })
        
        return {
            jpegImg: jpegImg,
            stream:  jpegStream,
            expires: expires.toUTCString()
        }
    }
}
    

   



        // // Draw the title
        

        // // Draw the color key labels        
        // ctx.font = smallFont;

        // ctx.fillStyle = temperatureColor;
        // ctx.fillText("Temperature", topLegendLeftIndent, 30);

        // ctx.fillStyle = dewPointColor;
        // ctx.fillText("Dew Point", topLegendLeftIndent, 60);

        // ctx.fillStyle = windSpeedColor;
        // ctx.fillText("Wind Speed", topLegendLeftIndent, 90);

        // let startX: number;
        // let startY: number;
        // let endX: number;
        // let endY: number;

        // // We need to skip past the time that has past today.  Start at current hour.
        // const firstHour: number = new Date().getHours(); // 0-23
        // // this.logger.info("First Hour: " + firstHour);

        // //
        // // Draw the cloud cover in the background (filled)
        // //
        // ctx.fillStyle = 'rgb(50, 50, 50)';

        // // if there are 120 hours to show, and first hour is 0
        // // we want to access wData in the range 0-119
        // // since each iteration uses i and i+1, we want to loop from 0-118
        // //
        // // if we start 10 hours into the day, we will loop from 0-109
        // // We do start plotting the data firstHour * pointsPerHour after the y axis
        // for (let i: number = 0; i < (hoursToShow - firstHour - 1); i++) {
        //     startX = chartOriginX + (i + firstHour) * pointsPerHour;
        //     endX   = chartOriginX + (i + firstHour + 1) * pointsPerHour;
        //     startY = chartOriginY - wData.cloudCover(i) * pointsPerDegree;
        //     endY   = chartOriginY - wData.cloudCover(i + 1) * pointsPerDegree;

        //     // console.log("Cover: [" + i + "] = " + " StartX: " + startX + " EndX: " + endX);

        //     ctx.beginPath();
        //     ctx.moveTo(startX, chartOriginY);          // Start at bottom left
        //     ctx.lineTo(startX, startY);     // Up to the height of startY
        //     ctx.lineTo(endX, endY);         // across the top to endY       
        //     ctx.lineTo(endX, chartOriginY);            // down to the bottom right
        //     ctx.lineTo(startX, chartOriginY);          // back to the bottom left
        //     ctx.fill();
        // }

        // startX = chartOriginX + (hoursToShow -1) * pointsPerHour;
        // endX   = chartOriginX + (hoursToShow) * pointsPerHour;
        // startY = chartOriginY - wData.cloudCover(hoursToShow - 1) * pointsPerDegree;
        // endY   = chartOriginY - wData.cloudCover(hoursToShow) * pointsPerDegree;

        // ctx.beginPath();
        // ctx.moveTo(startX, chartOriginY);          // Start at bottom left
        // ctx.lineTo(startX, startY);     // Up to the height of startY
        // ctx.lineTo(endX, endY);         // across the top to endY       
        // ctx.lineTo(endX, chartOriginY);            // down to the bottom right
        // ctx.lineTo(startX, chartOriginY);          // back to the bottom left
        // ctx.fill();

        // //
        // // Draw the probability of precipitation at the bottom.  The rain amount will cover part of this up.
        // //
        // ctx.fillStyle = 'rgb(40, 60, 100)';  // A little more blue

        // // if there are 120 hours to show, and first hour is 0
        // // we want to access wData in the range 0-119
        // // since each iteration uses i and i+1, we want to loop from 0-118
        // //
        // // if we start 10 hours into the day, we will loop from 0-109
        // // We do start plotting the data firstHour * pointsPerHour after the y axis
        // for (let i: number = 0; i < (hoursToShow - firstHour - 1); i++) {
        //     startX = chartOriginX + (i + firstHour) * pointsPerHour;
        //     endX   = chartOriginX + (i + firstHour + 1) * pointsPerHour;
        //     startY = chartOriginY - wData.precipProb(i)  * pointsPerDegree;
        //     endY = chartOriginY - wData.precipProb(i + 1)  * pointsPerDegree;

        //     // this.logger.info("Cover: [" + i + "] = " + " StartX: " + startX + " Precip: " + wData.precipAmt(i) + " Y1: " + (chartOriginY - startY) + " Y2: " + (chartOriginY - endY));

        //     ctx.beginPath();
        //     ctx.moveTo(startX, chartOriginY);          // Start at bottom left
        //     ctx.lineTo(startX, startY);     // Up to the height of startY
        //     ctx.lineTo(endX, endY);         // across the top to endY       
        //     ctx.lineTo(endX, chartOriginY);            // down to the bottom right
        //     ctx.lineTo(startX, chartOriginY);          // back to the bottom left
        //     ctx.fill();
        // }

        // //
        // // Draw the rain amount in the background over the clouds (filled)
        // //
        // ctx.fillStyle = 'rgb(40, 130, 150)';  // A little more blue

        // // if there are 120 hours to show, and first hour is 0
        // // we want to access wData in the range 0-119
        // // since each iteration uses i and i+1, we want to loop from 0-118
        // //
        // // if we start 10 hours into the day, we will loop from 0-109
        // // We do start plotting the data firstHour * pointsPerHour after the y axis
        // for (let i: number = 0; i < (hoursToShow - firstHour - 1); i++) {
        //     startX = chartOriginX + (i + firstHour) * pointsPerHour;
        //     endX   = chartOriginX + (i + firstHour + 1) * pointsPerHour;
        //     startY = chartOriginY - wData.precipAmt(i)  * pointsPerDegree;
        //     endY = chartOriginY - wData.precipAmt(i + 1)  * pointsPerDegree;

        //     // this.logger.info("Cover: [" + i + "] = " + " StartX: " + startX + " Precip: " + wData.precipAmt(i) + " Y1: " + (chartOriginY - startY) + " Y2: " + (chartOriginY - endY));

        //     ctx.beginPath();
        //     ctx.moveTo(startX, chartOriginY);          // Start at bottom left
        //     ctx.lineTo(startX, startY);     // Up to the height of startY
        //     ctx.lineTo(endX, endY);         // across the top to endY       
        //     ctx.lineTo(endX, chartOriginY);            // down to the bottom right
        //     ctx.lineTo(startX, chartOriginY);          // back to the bottom left
        //     ctx.fill();
        // }

        // startX = chartOriginX + (hoursToShow -1) * pointsPerHour;
        // endX   = chartOriginX + (hoursToShow) * pointsPerHour;
        // startY = chartOriginY - wData.precipAmt(hoursToShow - 1) * pointsPerDegree;
        // endY   = chartOriginY - wData.precipAmt(hoursToShow) * pointsPerDegree;

        // ctx.beginPath();
        // ctx.moveTo(startX, chartOriginY);          // Start at bottom left
        // ctx.lineTo(startX, startY);     // Up to the height of startY
        // ctx.lineTo(endX, endY);         // across the top to endY       
        // ctx.lineTo(endX, chartOriginY);            // down to the bottom right
        // ctx.lineTo(startX, chartOriginY);          // back to the bottom left
        // ctx.fill();

        // // Draw the grid lines

        // // Draw the thin hour vertical lines
        // if (showHourGridLines) {
        //     ctx.strokeStyle = gridLinesColor;
        //     ctx.lineWidth = thinStroke;
        //     for (let i: number = 0; i <= verticalFineGridLines; i++) {
        //         startX = chartOriginX + (i * verticalFineGridSpacing);
        //         endX = chartOriginX + (i * verticalFineGridSpacing);
        //         startY = chartOriginY;
        //         endY = chartOriginY - (chartHeight);

        //         ctx.beginPath();
        //         ctx.moveTo(startX, startY);
        //         ctx.lineTo(endX, endY);
        //         ctx.stroke();
        //     }
        // }

        // // Draw the regular vertical lines
        // ctx.strokeStyle = gridLinesColor;
        // ctx.lineWidth = regularStroke;
        // for (let i: number = 0; i <= verticalGridLines; i++) {
        //     startX = chartOriginX + (i * Line);
        //     endX = chartOriginX + (i * Line);
        //     startY = chartOriginY;
        //     endY = chartOriginY - (chartHeight);

        //     ctx.beginPath();
        //     ctx.moveTo(startX, startY);
        //     ctx.lineTo(endX, endY);
        //     ctx.stroke();
        // }

        // // Draw the major vertical lines
        // ctx.strokeStyle = majorGridLinesColor;
        // ctx.lineWidth = heavyStroke;
        // for (let i: number = 0; i <= verticalGridLines; i ++) {
        //     startX = chartOriginX + (i * verticalMajorGridSpacing);
        //     endX = chartOriginX + (i * verticalMajorGridSpacing);
        //     startY = chartOriginY;
        //     endY = chartOriginY - (chartHeight);

        //     ctx.beginPath();
        //     ctx.moveTo(startX, startY);
        //     ctx.lineTo(endX, endY);
        //     ctx.stroke();
        // }

        // // Draw the horizontal lines
        // ctx.strokeStyle = gridLinesColor;
        // ctx.lineWidth = regularStroke;
        // for (let i: number = 0; i <= horizontalGridLines; i++) {
        //     startX = chartOriginX;
        //     endX = chartOriginX + chartWidth;
        //     startY = chartOriginY - (i * horizontalGridSpacing);
        //     endY = chartOriginY - (i * horizontalGridSpacing);

        //     ctx.beginPath();
        //     ctx.moveTo(startX, startY);
        //     ctx.lineTo(endX, endY);
        //     ctx.stroke();
        // }

        // // Draw the major horizontal lines (typically at 0 and 100)
        // ctx.strokeStyle = majorGridLinesColor;
        // ctx.lineWidth = heavyStroke;
        // for (let i: number = 0; i <= 1; i++) {
        //     startX = chartOriginX;
        //     endX   = chartOriginX + chartWidth;
        //     startY = chartOriginY - (i * chartHeight);
        //     endY   = chartOriginY - (i * chartHeight);

        //     ctx.beginPath();
        //     ctx.moveTo(startX, startY);
        //     ctx.lineTo(endX, endY);
        //     ctx.stroke();
        // }

        // // Draw an orange line at 75 degrees
        // ctx.strokeStyle = 'orange';
        // startX = chartOriginX;
        // endX = chartOriginX + chartWidth;
        // startY = chartOriginY - (horizontalGridSpacing * 75) / 10;
        // endY = chartOriginY - (horizontalGridSpacing * 75) / 10;

        // ctx.beginPath();
        // ctx.moveTo(startX, startY);
        // ctx.lineTo(endX, endY);
        // ctx.stroke();

        // // Draw an blue line at 32 degrees
        // ctx.strokeStyle = 'rgb(0, 0, 200)';
        // startX = chartOriginX;
        // endX = chartOriginX + chartWidth;
        // startY = chartOriginY - (horizontalGridSpacing * 32) / 10;
        // endY = chartOriginY - (horizontalGridSpacing * 32) / 10;

        // ctx.beginPath();
        // ctx.moveTo(startX, startY);
        // ctx.lineTo(endX, endY);
        // ctx.stroke();

        // // Draw the axis labels
        // ctx.font = mediumFont;
        // ctx.fillStyle = 'rgb(200, 200, 200)';

        // for (let i: number = 0; i <= horizontalGridLines; i++) {
        //     // i = 0, 1 ..10    labelString = "0", "10" .. "100"
        //     const labelString: string = (i * (fullScaleDegrees/horizontalGridLines)).toString(); 

        //     const labelStringWdth: number = ctx.measureText(labelString).width;
        //     const x: number = chartOriginX - 50;
        //     const y: number = chartOriginY + 10 - (i * horizontalGridSpacing);
        //     ctx.fillText(labelString, x - labelStringWdth / 2, y);
        // }       

        // const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // for (let i: number = 0; i < (hoursToShow / 24); i++) {
        //     const date = new Date(Date.parse(wData.timeString(i * 24)));
        //     const dayStr: string = weekday[date.getDay()];
        //     const dayStrWdth: number = ctx.measureText(dayStr).width;


        //     const x: number = chartOriginX + (i * 4 + 2) * Line;
        //     const y: number = chartOriginY + 40;

        //     ctx.fillText(dayStr, x - dayStrWdth / 2, y);
        // }

        // ctx.lineWidth = heavyStroke;

        // // Draw the temperature line
        // ctx.strokeStyle = temperatureColor;
        // ctx.beginPath();
        // ctx.moveTo(chartOriginX + pointsPerHour * firstHour, chartOriginY - (wData.temperature(0) * chartHeight) / fullScaleDegrees);
        
        // for (let i: number =  0; i <= (hoursToShow - firstHour - 1); i++) {
        //     ctx.lineTo(chartOriginX + pointsPerHour * (i + firstHour), chartOriginY - (wData.temperature(i) * chartHeight) / fullScaleDegrees);
        // }
        // ctx.lineTo(chartOriginX + pointsPerHour * hoursToShow, chartOriginY - (wData.temperature(hoursToShow - firstHour) * chartHeight) / fullScaleDegrees);
        // ctx.stroke();

        // // Draw the dew point line
        // ctx.strokeStyle = dewPointColor;
        // ctx.beginPath();
        // ctx.moveTo(chartOriginX + pointsPerHour * firstHour, chartOriginY - (wData.dewPoint(0) * chartHeight) / fullScaleDegrees);
        // for (let i: number =  0; i <= (hoursToShow - firstHour - 1); i++) {
        //     ctx.lineTo(chartOriginX + pointsPerHour * (i + firstHour), chartOriginY - (wData.dewPoint(i) * chartHeight) / fullScaleDegrees);
        // }
        // ctx.lineTo(chartOriginX + pointsPerHour * hoursToShow, chartOriginY - (wData.dewPoint(hoursToShow - firstHour) * chartHeight) / fullScaleDegrees);        
        // ctx.stroke();

        // // Draw the wind speed line
        // ctx.strokeStyle = windSpeedColor;
        // ctx.beginPath();
        // ctx.moveTo(chartOriginX + pointsPerHour * firstHour, chartOriginY - (wData.windSpeed(0) * chartHeight) / fullScaleDegrees);
        // for (let i: number =  0; i <= (hoursToShow - firstHour - 1); i++) {
        //     ctx.lineTo(chartOriginX + pointsPerHour * (i + firstHour), chartOriginY - (wData.windSpeed(i) * chartHeight) / fullScaleDegrees);
        // }
        // ctx.lineTo(chartOriginX + pointsPerHour * hoursToShow, chartOriginY - (wData.windSpeed(hoursToShow - firstHour) * chartHeight) / fullScaleDegrees);
        // ctx.stroke();

        // const expires = new Date();
        // expires.setHours(expires.getHours() + 2);

        // const jpegImg = await jpeg.encode(img, 50);

        // const jpegStream = new stream.Readable({
        //     read() {
        //         this.push(jpegImg.data);
        //         this.push(null);
        //     }
        // })
        
        // return {
        //     jpegImg: jpegImg,
        //     stream:  jpegStream,
        //     expires: expires.toUTCString()
        // }

