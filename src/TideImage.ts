/* eslint-disable @typescript-eslint/no-unused-vars */
import path from "path";
import jpeg from "jpeg-js";
import * as pure from "pureimage";
import { TideData } from "./TideData";
import { LoggerInterface } from "./Logger";
import { KacheInterface} from "./Kache";

export interface ImageResult {
    imageType: string;
    imageData: jpeg.BufferRet | null;
}

export class TideImage {
    private tideData: TideData;
    private cache: KacheInterface;
    private logger: LoggerInterface;

    constructor(logger: LoggerInterface, cache: KacheInterface) {
        this.logger = logger;
        this.cache = cache;
        this.tideData = new TideData(this.logger, this.cache);
    }

    /**
     * Optimized fill routine for pureimage
     * - See https://github.com/joshmarinacci/node-pureimage/tree/master/src
     * - To fill a 1920x1080 image on a core i5, this saves about 1.5 seconds
     * @param img it has 3 properties height, width and data
     * @param x X position of the rect
     * @param y Y position of the rect
     * @param w Width of rect
     * @param h Height of rect
     * @param rgb Fill color in "#112233" format
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private myFillRect(img: any, x: number, y: number, w: number, h: number, rgb: string) {
        const colorValue = parseInt(rgb.substring(1), 16);

        // The shift operator forces js to perform the internal ToUint32 (see ecmascript spec 9.6)
        const r = (colorValue >>> 16) & 0xFF;
        const g = (colorValue >>> 8)  & 0xFF;  
        const b = (colorValue)        & 0xFF;
        const a = 0xFF;

        for(let i = y; i < y + h; i++) {                
            for(let j = x; j < x + w; j++) {   
                const index = (i * img.width + j) * 4;   
                
                img.data[index + 0] = r;
                img.data[index + 1] = g;     
                img.data[index + 2] = b;     
                img.data[index + 3] = a; 
            }
        }
    }

    public async getImage(station: string, location: string, timeZone: string, application: string): Promise<ImageResult | null> {
        this.logger.verbose(`TideImage: request for ${location}, station: ${station}`);

        const title = `Tides at ${location}`;
        
        interface Prediction {
            t: string;
            v: string;
        }

        const predictionsArray: Array<Prediction> | null = await  this.tideData.getTideData(station, timeZone, application);

        // {
        //     "predictions": [
        //         {   "t": "2021-07-11 00:00", "v": "3.362" },
        //         {   "t": "2021-07-11 00:06", "v": "3.542" },
        //         ...
        //     ]
        // }

        if (predictionsArray === null) {
            return null;
        }

        // Get the min and max tide levels - we need this to figure out the scale below
        let maxLevel = 0.0;
        let minLevel = 0.0;

        for (const prediction of predictionsArray) {
            const tideLevel: number = parseFloat(prediction.v);

            if (tideLevel > maxLevel)
                maxLevel = tideLevel;

            if (tideLevel < minLevel)
                minLevel = tideLevel;
        }

        const imageHeight                      = 1080; 
        const imageWidth                       = 1920; 

        // Screen origin is the upper left corner
        // Java Canvas: origin is upper left.  positive number to the right and down.
        const  chartOriginX                    = 120;                    // In from the left edge
        const  chartOriginY                    = imageHeight - 70;       // Down from the top (Was: Up from the bottom edge)

        let horizontalGridLineCount: number;
        let horizontalGridSpacing: number;
        let gridStep                           = 0;

        // Determine the grid count and grid size.  
        //  - count * size ~= 900 to fit the space
        //  - gridLineCount has one extra for negative tides of up to 1 ft.
        //  - gridStep - how many feet per grid line and label
        if (maxLevel <= 6) {
            horizontalGridLineCount            = 7;   // Support ranges to -1 ft. 
            horizontalGridSpacing              = 128;  // 896
            gridStep                           = 1;
        } else if (maxLevel <= 12) {
            horizontalGridLineCount            = 14;  // Supports ranges to -2 ft.
            horizontalGridSpacing              = 64;   // 896
            gridStep                           = 2;
        }else {
            horizontalGridLineCount             = 28;  // Supports ranges to -4 ft.
            horizontalGridSpacing               = 32;   // 896
            gridStep                            = 4;
        }

        const verticalGridLineCount             = 24;    // Plus a line at 0, vertical line at each hour
        const verticalGridLineSpacing           = 70;  // 70 * 24 = 1680 pixels wide, should be a multiple of 10 since 10 data points/hour

        // The chartWidth will be smaller than the imageWidth but must be a multiple of hoursToShow
        const  chartWidth: number                = verticalGridLineCount   * verticalGridLineSpacing; // 24 * 70 = 1680
        const  chartHeight: number               = horizontalGridLineCount * horizontalGridSpacing;   // Around 900 

        const verticalMajorGridLineCount         = 2;                                      // 0, 12 and 24 hours
        const verticalMajorGridSpacing: number   = (verticalGridLineSpacing * 12);         // every 12 hours
        
        const horizontalMajorGridLineCount       = 1;
        const horizontalMajorGridSpacing: number = chartHeight;

        const pixelsPerTideLevel: number         = horizontalGridSpacing;        
        const pixelsPerDataPoint: number         = verticalGridLineSpacing / 10;            // 7 pixels if verticalGridLineSpacing is 70
        const dataPointsPerHour                  = 10;                                      // There are 10 predictions points per hour, every 6 minutes.
        const pixelsPerHour: number              = pixelsPerDataPoint * dataPointsPerHour;  // 70,  Same as verticalGridLineSpacing!

        const horizontalLabelOffset              = 50;                                      // below the bottom of the chart
        const verticalLabelOffset                = 50;                                      // left of the chart left edge

        const titleOffsetY                       = 80;                                      // down from the top of the image
        const dateX                              = 40;                                      // Draw the date on the right hand side
        const dateY                              = 65;
                                           
        const backgroundColor                    = "#F0F0FF";
        const titleColor                         = "#000096";
        const gridLinesColor                     = "#969696";
        const majorGridLinesColor                = "#424242";
        const tideColor                          = "rgba(0,   100,   150, 0.7)";
        const todayLineColor                     = "rgba(255,  0,     0, 0.7)";

        const largeFont                          = "60px 'OpenSans-Bold'";   // Title
        const mediumFont                         = "36px 'OpenSans-Bold'";   // axis labels

        // When used as an npm package, fonts need to be installed in the top level of the main project
        const fntBold     = pure.registerFont(path.join(".", "fonts", "OpenSans-Bold.ttf"),"OpenSans-Bold");
        const fntRegular  = pure.registerFont(path.join(".", "fonts", "OpenSans-Regular.ttf"),"OpenSans-Regular");
        const fntRegular2 = pure.registerFont(path.join(".", "fonts", "alata-regular.ttf"),"alata-regular");
        
        fntBold.loadSync();
        fntRegular.loadSync();
        fntRegular2.loadSync();

        const regularStroke = 2;
        const heavyStroke = 8;

        const img = pure.make(imageWidth, imageHeight);
        const ctx = img.getContext("2d");

        // Extend ctx with function to draw centered text
        ctx.centerText = function(text: string, x: number, y: number): void {
            const width = this.measureText(text).width;
            this.fillText(text, x - width/2, y);
        };

        // Fill the bitmap
        this.myFillRect(img, 0, 0, imageWidth, imageHeight, backgroundColor);

        // Draw the title
        ctx.fillStyle = titleColor;
        ctx.font = largeFont;
        ctx.centerText(title, imageWidth/2, titleOffsetY);
        //const textWidth: number = ctx.measureText(title).width;
        //ctx.fillText(title, (imageWidth - textWidth) / 2, titleOffsetY);

        // Draw the date in the upper left
        const dataDate = new Date(predictionsArray[0].t);
        ctx.font = mediumFont;
        ctx.fillText(dataDate.toLocaleDateString(), dateX, dateY);

        // Draw the labels on the Y axis
        ctx.font = mediumFont;
        
        for (let i = 0; i < horizontalGridLineCount; i += gridStep) {
            ctx.fillText(`${i}`, chartOriginX - verticalLabelOffset, chartOriginY + 10 - ((i + gridStep) * horizontalGridSpacing));
        }

        // Draw the labels on the X axis
        ctx.font = mediumFont;
        for (let hour = 0; hour <= 24; hour += 3) {
            let label: string;
            if (hour == 0 || hour == 24) {
                label = "12 AM";
            } else if (hour > 12) {
                label = `${hour - 12}`;
            } else {
                label = `${hour}`;
            }

            ctx.centerText(label, (chartOriginX + (hour * verticalGridLineSpacing)), chartOriginY + horizontalLabelOffset);
            //const textWidth: number = ctx.measureText(label).width;
            //ctx.fillText(label, (chartOriginX + (hour * verticalGridLineSpacing)) - textWidth/2, chartOriginY + horizontalLabelOffset);
        }

        // Draw the regular vertical lines
        ctx.strokeStyle = gridLinesColor;
        ctx.lineWidth = regularStroke;
        for (let i = 0; i <= verticalGridLineCount; i++) {
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
        for (let i = 0; i <= verticalMajorGridLineCount; i++) {
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
        for (let i = 0; i <= horizontalGridLineCount; i += gridStep) {
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
        for (let i = 0; i <= horizontalMajorGridLineCount; i++) {
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

        let x = 0;
        let y = 0;
        for (let i = 0; i < predictionsArray.length; i++) {
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

        // Draw the line at the current time based on the timeZone the station is in
        // Local en-GB gives us 24 hours times
        // Split on space, take the second element, split on ':'
        const now = new Date();
        const localTimeParts = now.toLocaleString("en-GB", { timeZone: timeZone }).split(" ")[1].split(":"); 
        const minutesToday: number = +localTimeParts[0] * 60 + +localTimeParts[1];

        ctx.strokeStyle = todayLineColor;
        ctx.lineWidth = heavyStroke;
        ctx.beginPath();
        ctx.moveTo(chartOriginX + (minutesToday * pixelsPerHour)/ 60, chartOriginY);
        ctx.lineTo(chartOriginX + (minutesToday * pixelsPerHour)/ 60, chartOriginY - chartHeight);
        ctx.stroke();

        const jpegImg: jpeg.BufferRet = jpeg.encode(img, 80);
        
        return {
            imageData: jpegImg,
            imageType: "jpg"
        };
    }
}