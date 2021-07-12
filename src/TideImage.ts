import stream from 'stream';
import jpeg from 'jpeg-js';
//import pure from 'pureimage';
const pure = require('pureimage');
import { TideData } from './TideData';

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

    public async getImageStream(station: string, location: string, application: string) {
        this.logger.info(`TideImage: request for ${location}, station: ${station}`);

        const title = `Tides at ${location}`;
        
        this.tideData = new TideData(this.logger);

        interface Prediction {
            t: string;
            v: string;
        }

        const predictionsArray: Array<Prediction> = await  this.tideData.getTideData(station, application);

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

        // Get the min and max tide levels - we need this to figure out the scale below
        let maxLevel: number = 0.0;
        let minLevel: number = 0.0;

        for (let prediction of predictionsArray) {
            // this.logger.log(`Prediction: ${prediction}`);
            // this.logger.log(`Level: ${prediction.v}, Time: ${prediction.t}`)
            const tideLevel: number = parseFloat(prediction.v);

            if (tideLevel > maxLevel)
                maxLevel = tideLevel;

            if (tideLevel < minLevel)
                minLevel = tideLevel;
        }

        const imageHeight: number = 1080; // 800;
        const imageWidth: number  = 1920; // 1280;

        // Screen origin is the upper left corner
        // Java Canvas: origin is upper left.  positive number to the right and down.
        const  chartOriginX = 120;                    // In from the left edge
        const  chartOriginY = imageHeight - 70;       // Down from the top (Was: Up from the bottom edge)

        let horizontalGridLineCount: number;
        let horizontalGridSpacing: number;
        let gridStep: number = 1;
        // Determine the grid count and grid size.  
        //  - count * size ~= 900 to fit the space
        //  - gridLineCount has one extra for negative tides of up to 1 ft.
        //  - gridStep - how many feet per grid line and label

        if (maxLevel <= 6) {
            horizontalGridLineCount = 7;   // Support ranges to -1 ft. 
            horizontalGridSpacing  = 128;  // 896
            gridStep = 1;
        } else if (maxLevel <= 12) {
            horizontalGridLineCount = 14;  // Supports ranges to -2 ft.
            horizontalGridSpacing  = 64;   // 896
            gridStep = 2;
        }else {
            horizontalGridLineCount = 28;  // Supports ranges to -4 ft.
            horizontalGridSpacing  = 32;   // 896
            gridStep = 4;
        }

        const verticalGridLineCount: number = 24;    // Plus a line at 0, vertical line at each hour
        const verticalGridLineSpacing: number = 70;  // 70 * 24 = 1680 pixels wide, should be a multiple of 10 since 10 data points/hour

         // The chartWidth will be smaller than the imageWidth but must be a multiple of hoursToShow
         const  chartWidth: number  = verticalGridLineCount   * verticalGridLineSpacing; // 24 * 70 = 1680
         const  chartHeight: number = horizontalGridLineCount * horizontalGridSpacing;   // Around 900 

        const verticalMajorGridLineCount: number = 2;  // 0, 12 and 24 hours
        const verticalMajorGridSpacing: number = (verticalGridLineSpacing * 12);  // every 12 hours
        
        const horizontalMajorGridLineCount: number = 1;
        const horizontalMajorGridSpacing: number   = chartHeight;

        const pixelsPerTideLevel: number = horizontalGridSpacing;        // 
        const pixelsPerDataPoint: number = verticalGridLineSpacing / 10; // 7 pixels if verticalGridLineSpacing is 70
        const dataPointsPerHour: number  = 10;                           // There are 10 predictions points per hour, every 6 minutes.
        const pixelsPerHour: number      = pixelsPerDataPoint * dataPointsPerHour;  // 70,  Same as verticalGridLineSpacing!

        const titleOffset: number = 80; // down from the top of the image
        const horizontalLabelOffset: number = 50; // below the bottom of the chart
        const verticalLabelOffset: number = 50; // left of the chart left edge

        const backgroundColor: string     = 'rgb(240, 240,   255)';
        const titleColor: string          = 'rgb(0,     0,   150)';
        const gridLinesColor: string      = 'rgb(150, 150,   150)';
        const majorGridLinesColor: string = 'rgb(50,   50,   50)';
        const tideColor: string           = 'rgba(0,   100,   150, 0.7)';
        const todayLineColor: string      = 'rgba(255,  0,     0, 0.7)';

        const largeFont: string  = "60px 'OpenSans-Bold'";   // Title
        const mediumFont: string = "36px 'OpenSans-Bold'";   // axis labels
        const smallFont: string  = "24px 'OpenSans-Bold'";   

        const fntBold     = pure.registerFont(fontDir + '/OpenSans-Bold.ttf','OpenSans-Bold');
        const fntRegular  = pure.registerFont(fontDir + '/OpenSans-Regular.ttf','OpenSans-Regular');
        const fntRegular2 = pure.registerFont(fontDir + '/alata-regular.ttf','alata-regular');

        fntBold.loadSync();
        fntRegular.loadSync();
        fntRegular2.loadSync();

        const thinStroke: number = 1;
        const regularStroke: number = 2;
        const heavyStroke: number = 8;
        const veryHeavyStroke: number = 20;

        const img = pure.make(imageWidth, imageHeight);
        const ctx = img.getContext('2d');

        // Fill the bitmap
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, imageWidth, imageHeight);

        // Draw the title
        ctx.fillStyle = titleColor;
        ctx.font = largeFont;
        const textWidth: number = ctx.measureText(title).width;
        ctx.fillText(title, (imageWidth - textWidth) / 2, titleOffset);

        // Draw the labels on the Y axis
        ctx.font = mediumFont;
        
        for (let i = 0; i < horizontalGridLineCount; i += gridStep) {
            ctx.fillText(`${i}`, chartOriginX - verticalLabelOffset, chartOriginY + 10 - ((i + gridStep) * horizontalGridSpacing));
        }

        // Draw the labels on the X axis
        ctx.font = mediumFont;
        for (let hour: number = 0; hour <= 24; hour += 3) {
            let label: string;
            if (hour == 0 || hour == 24) {
                label = "12 AM";
            } else if (hour > 12) {
                label = `${hour - 12}`
            } else {
                label = `${hour}`;
            }

            const textWidth: number = ctx.measureText(label).width;
            ctx.fillText(label, (chartOriginX + (hour * verticalGridLineSpacing)) - textWidth/2, chartOriginY + horizontalLabelOffset);
        }

        // Draw the regular vertical lines
        ctx.strokeStyle = gridLinesColor;
        ctx.lineWidth = regularStroke;
        for (let i: number = 0; i <= verticalGridLineCount; i++) {
            const startX: number = chartOriginX + (i * verticalGridLineSpacing);
            const endX: number = chartOriginX + (i * verticalGridLineSpacing);
            const startY: number = chartOriginY;
            const endY: number = chartOriginY - (chartHeight + 1); // fill in the last pixel at the top

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Draw the major vertical lines
        ctx.strokeStyle = majorGridLinesColor;
        ctx.lineWidth = heavyStroke;
        for (let i: number = 0; i <= verticalMajorGridLineCount; i++) {
            const startX: number = chartOriginX + (i * verticalMajorGridSpacing);
            const endX   = chartOriginX + (i * verticalMajorGridSpacing);
            const startY: number = chartOriginY;
            const endY   = chartOriginY - (chartHeight);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Draw the horizontal grid lines 
        ctx.strokeStyle = gridLinesColor;
        ctx.lineWidth = regularStroke;
        for (let i: number = 0; i <= horizontalGridLineCount; i += gridStep) {
            const startX: number = chartOriginX;
            const endX   = chartOriginX + chartWidth;
            const startY: number = chartOriginY - (i * horizontalGridSpacing);
            const endY   = chartOriginY - (i * horizontalGridSpacing);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Draw the major horizontal lines
        ctx.strokeStyle = majorGridLinesColor;
        ctx.lineWidth = heavyStroke;
        for (let i: number = 0; i <= horizontalMajorGridLineCount; i++) {
            const startX: number = chartOriginX;
            const endX   = chartOriginX + chartWidth;
            const startY: number = chartOriginY - (i * horizontalMajorGridSpacing);
            const endY   = chartOriginY - (i * horizontalMajorGridSpacing);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Draw the water level area

        // Start at chart origin
        ctx.fillStyle = tideColor;
        ctx.beginPath();
        ctx.moveTo(chartOriginX, chartOriginY);

        let x: number = 0;
        let y: number = 0;
        for (let i: number = 0; i < predictionsArray.length; i++) {
            x = i * pixelsPerDataPoint;
            y = ((parseFloat(predictionsArray[i].v) + 1) * pixelsPerTideLevel);

            ctx.lineTo(chartOriginX + x, chartOriginY - y);
        }
        // Add one more point at the end to bring us up to the right grid line
        x += pixelsPerDataPoint;
        ctx.lineTo(chartOriginX + x, chartOriginY - y);

        // Close off the bottom of the region and back to the chart origin and then fill
        ctx.lineTo(chartOriginX + chartWidth, chartOriginY);
        ctx.lineTo(chartOriginX, chartOriginY);
        ctx.fill();

        // Draw the line at the current time
        const now = new Date();
        const minutesToday: number = now.getHours() * 60 + now.getMinutes();

        ctx.strokeStyle = todayLineColor;
        ctx.lineWidth = veryHeavyStroke;
        ctx.beginPath();
        ctx.moveTo(chartOriginX + (minutesToday * pixelsPerHour)/ 60, chartOriginY);
        ctx.lineTo(chartOriginX + (minutesToday * pixelsPerHour)/ 60, chartOriginY - chartHeight);
        ctx.stroke();

        // Finish up and save the image
        const expires: Date = new Date();
        expires.setMinutes(expires.getMinutes() + 30);

        const jpegImg: jpeg.BufferRet = await jpeg.encode(img, 50);

        const jpegStream: stream = new stream.Readable({
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

