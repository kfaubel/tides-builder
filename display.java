package org.faubel.daydreamone;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;

import static java.lang.System.currentTimeMillis;

@SuppressWarnings({"ALL", "PointlessArithmeticExpression"})
public class DisplayTides implements DisplayItem, DataSource {
    private static final String TAG = "DisplayTides";
    private final Object lock = new Object();
    private Context context;
    private String friendlyName;
    private String resource;
    private long expirationPeriodMins;
    private String currentDateStr;
    private long displayDurationSecs;
    private JSONObject tidesJSON;
    private long nextUpdateTime;
    private String station;
    private String errorStr;  // blank is no error

    public DisplayTides(Context context, JSONObject configData, ContentManager ContentManager) {
        this.context = context;
        try {
            this.friendlyName         = configData.getString("friendlyName");
            this.expirationPeriodMins = configData.getLong("expirationPeriodMins");
            this.displayDurationSecs  = configData.getLong("displayDurationSecs");

            this.station              = configData.getString("resource");
        } catch (JSONException e) {
            Klog.e(TAG, "constructor" + e.toString());
            e.printStackTrace();
        }

        Klog.i(TAG, "Creating DisplayTides: " + friendlyName + " station: " + station);

        tidesJSON = new JSONObject();

        currentDateStr = "not set";
        errorStr = "";

        nextUpdateTime = 0;
        ContentManager.addModel(this);
    }

    public long getDisplayDurationSecs() {
        return displayDurationSecs;
    }

    public int size() {
        synchronized(lock) {
            return 1;
        }
    }

    public String getTAG() { return TAG;}

    public String getFriendlyName() { return friendlyName;}

    // Font info: http://stackoverflow.com/questions/19691530/valid-values-for-androidfontfamily-and-what-they-map-to
    public Bitmap getBitmap(int index) {
        // Constants
        int height = 800;
        int width  = 1280;

        int originX = 100;
        int originY = height - 60;

        int verticalGridLineCount  = 24; // Plus a line at 0
        int horizontalridLineCount = 8;  // plus a line at 0

        int horizontalGridSpacing = 80;     // space between horizontal lines   8 horizontal lines, 7 segments over  640 pixels     80 pixels/foot
        int verticalGridSpacing =   45;     // space between vertical lines     25 vertical lines , 24 segments over 1100 pixels
        Double LowestLowTideAdjustment = 0.0;

        Bitmap imageBitmap = Bitmap.createBitmap(1280, 800, Bitmap.Config.RGB_565);
        Canvas canvas = new Canvas(imageBitmap);
        canvas.drawRGB(240, 240, 255);

        Paint p = new Paint();
        Rect bounds = new Rect();

        try {
            JSONObject tideObject = null; // local copy
            JSONArray tideDataArray = null;

            // Ensure that we don't access tidesJSON while it is being written
            synchronized(lock) {
                tideObject = tidesJSON;
            }

            // Check for an error and draw a message on a blank screen for display
            String errorMsg = "";
            try {
                JSONObject errorObject = tideObject.getJSONObject("error");
                errorMsg = errorObject.getString("message");

                p.setColor(Color.BLUE);
                p.setTextSize(24);
                String stationStr = "Station: " + station;
                p.getTextBounds(stationStr, 0, stationStr.length(), bounds);
                canvas.drawText(stationStr, width/2 - bounds.width()/2, 200, p);

                p.getTextBounds(errorMsg, 0, errorMsg.length(), bounds);
                canvas.drawText(errorMsg, width/2 - bounds.width()/2, 250, p);

                String urlString = "See: https://tidesandcurrents.noaa.gov/stations.html";
                p.getTextBounds(urlString, 0, urlString.length(), bounds);
                canvas.drawText(urlString, width/2 - bounds.width()/2, 300, p);
                return imageBitmap;
            } catch(JSONException e) {
               // No error, that's good
            }

            try {
                tideDataArray = tideObject.getJSONArray("predictions");
            } catch(JSONException e) {
                //Klog.v(TAG, "Unable to get predictions array from tideObject");
                return null;
            }

            // Get the min and max tide levels
            Double maxLevel = 0.0;
            Double minLevel = 0.0;
            for (int i = 0; i < tideDataArray.length(); i++) {
                JSONObject tideData = tideDataArray.getJSONObject(i);

                // 'v' is in feet (e.g.: 1.28, 2.74...)
                Double tideLevel = tideData.getDouble("v");

                if (tideLevel > maxLevel)
                    maxLevel = tideLevel;

                if (tideLevel < minLevel)
                    minLevel = tideLevel;
            }

            // Set the Y axis grid lines depending on the maximum tide level
            // We always cover 1 foot below normal low tide level of periodic very low tides.
            if (maxLevel < 8) {
                horizontalridLineCount = 9;
                horizontalGridSpacing  = 72; // 9 * 72 = 648
            } else if (maxLevel < 12) {
                horizontalridLineCount = 13;
                horizontalGridSpacing  = 50; // 650
            } else if (maxLevel < 16) {
                horizontalridLineCount = 17;
                horizontalGridSpacing  = 38; // 646
            } else if (maxLevel < 20) {
                horizontalridLineCount = 21;
                horizontalGridSpacing  = 30; // 630
            } else if (maxLevel < 28) {
                horizontalridLineCount = 29;
                horizontalGridSpacing  = 22; // 638
            } else {
                horizontalridLineCount = 41;
                horizontalGridSpacing  = 16; // 656
            }

            // Draw the title
            p.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
            //p.setColor(Color.BLUE);
            p.setColor(Color.rgb(0,0,100));
            p.setTextSize(48);
            canvas.drawText(friendlyName, 160, 60, p);

            // Draw the labels on the Y axis
            p.setStrokeWidth(1f);
            p.setTextSize(24);
            // canvas.drawText(timeStr, 512 - bounds.width()/2, 300, p);

            // Label every foot unless there are more than 20 ft, then label every other one
            int labelStep = 1;
            if (horizontalGridSpacing < 32)
                labelStep = 2;

            canvas.drawText(Integer.toString(-1), originX - 50, originY + 10 - (0 * horizontalGridSpacing), p);
            for (int i = 0; i < horizontalridLineCount; i += labelStep) {
                canvas.drawText(Integer.toString(i), originX - 50, originY + 10 - ((i + 1) * horizontalGridSpacing), p);
            }

            // Draw the labels on the X axis
            for (int hour = 0; hour <= 24; hour += 3) {
                String label;
                if (hour == 0 || hour == 24) {
                    label = "12 AM";
                } else if (hour > 12) {
                    label = Integer.toString(hour - 12);
                } else {
                    label = Integer.toString(hour);
                }

                p.getTextBounds(label, 0, label.length(), bounds);
                canvas.drawText(label, (originX + (hour * verticalGridSpacing)) - bounds.width()/2, originY + 40, p);

            }

            p.setColor(Color.rgb(0,0,100));
            p.setStrokeJoin(Paint.Join.ROUND);
            p.setAntiAlias(true);
            p.setStrokeWidth(1f);

            // Draw the vertical grid lines
            p.setStrokeWidth(1f);
            for (int i = 0; i <= verticalGridLineCount; i = i + 3) {
                canvas.drawLine(originX + (i * verticalGridSpacing), originY, originX + (i * verticalGridSpacing), originY - (horizontalridLineCount * horizontalGridSpacing), p);
            }

            // Redraw the major lines with a heavier line
            p.setStrokeWidth(3f);
            canvas.drawLine(originX,                              originY, originX,                              originY - (horizontalridLineCount * horizontalGridSpacing), p);
            canvas.drawLine(originX + (12 * verticalGridSpacing), originY, originX + (12 * verticalGridSpacing), originY - (horizontalridLineCount * horizontalGridSpacing), p);
            canvas.drawLine(originX + (24 * verticalGridSpacing), originY, originX + (24 * verticalGridSpacing), originY - (horizontalridLineCount * horizontalGridSpacing), p);

            // Draw the horizontal grid lines
            p.setStrokeWidth(1f);
            for (int i = 0; i <= horizontalridLineCount; i++) {
                canvas.drawLine(originX, originY - (i * horizontalGridSpacing), originX + (24 * verticalGridSpacing), originY - (i * horizontalGridSpacing), p);
            }

            // Redraw the major lines with a heavier line
            // top, bottom and at the zero line
            p.setStrokeWidth(3f);
            canvas.drawLine(originX, originY - (0 * horizontalGridSpacing),                      originX + (24 * verticalGridSpacing), originY - (0 * horizontalGridSpacing),                      p);
            canvas.drawLine(originX, originY - (1 * horizontalGridSpacing),                      originX + (24 * verticalGridSpacing), originY - (1 * horizontalGridSpacing),                      p);
            canvas.drawLine(originX, originY - (horizontalridLineCount * horizontalGridSpacing), originX + (24 * verticalGridSpacing), originY - (horizontalridLineCount * horizontalGridSpacing), p);

            p.setStrokeWidth(3f);
            //p.setColor(Color.BLUE);
            p.setColor(Color.argb(80, 0,0,255));

            // We now have the tideDataArray that cannot be changed by update()

            if (tideDataArray == null) {
                Klog.w(TAG, "tideDataArray was null");
                return null;
            }

            Double lastLevel = 0.0;

            // As we fill in the gaps between two 6 minute samples we sometimes need 4 lines of fill and sometimes we need 5.  In cases when
            // we only need 4 fill lines we want to keep from drawing that line at X more than once.  We use recentX to keep track of the last X
            // line we drew and we won't draw it again.
            int recentX = 0;

            // Draw the tide data
            for (int i = 0; i < tideDataArray.length(); i++) {
                JSONObject tideData = tideDataArray.getJSONObject(i);

                String timeStr = tideData.getString("t");

                // 'v' is in feet (e.g.: 1.28, 2.74...)
                // LowestLowTideAdjustment is a Double like "1.0"

                Double tideLevel = (tideData.getDouble("v") + 1) * horizontalGridSpacing; // pixels above (or below) the grid line


                int level = tideLevel.intValue(); // pixels above the X axis

                //Double tideLevel100 = tideLevel * 100;
                //Klog.i(TAG, "i=" + i + " time: " + timeStr + "  tideLevel: " + tideLevel100.intValue() + " Y: " + level);

                Double xStart = originX + (i * 4.5);
                if (i == 0) {
                    canvas.drawLine(xStart.intValue(), originY, xStart.intValue(), originY - level, p);
                    //Klog.v(TAG, "X: " + xStart.intValue());
                } else {
                    // This a little tricky.  Here we identify the difference between two 6 minute samples and interpolate the
                    // three intermediate points to make a smooth transition between the two point we actually have.
                    // We do this with Doubles so we don't get a rounding errors that compound (if the step has a fraction we would
                    // like to include the fraction when we multiply it.  1.4 * 4 = 5.6 which rounds to 6.  1 x 4 = 4 so the
                    // lines would be slightly more jagged.

                    int stepCount = 5;
                    Double step = (lastLevel - level)/stepCount;
                    Double lineLevel;

                    int x = xStart.intValue();

                    // Sometimes we need 4 interplolated lines and sometimes 5.  If we have already drawn a line here at recentX, then skip this one.
                    if ((x - 4) != recentX) {
                        lineLevel = lastLevel - step * 1;
                        canvas.drawLine(x - 4, originY, x - 4, originY - lineLevel.intValue(), p);
                        //Klog.v(TAG, "X4: " + (x - 4));
                    }

                    lineLevel = lastLevel - step * 2;
                    canvas.drawLine(x - 3, originY, x - 3, originY - lineLevel.intValue(), p);
                    //Klog.v(TAG, "X3: " + (x - 3));

                    lineLevel = lastLevel - step * 3;
                    canvas.drawLine(x - 2, originY, x - 2, originY - lineLevel.intValue(), p);
                    //Klog.v(TAG, "X2: " + (x - 2));

                    lineLevel = lastLevel - step * 4;
                    canvas.drawLine(x - 1, originY, x - 1, originY - lineLevel.intValue(), p);
                    //Klog.v(TAG, "X1: " + (x - 1));

                    lineLevel = lastLevel - step * 5;
                    canvas.drawLine(x - 0, originY, x - 0, originY - lineLevel.intValue(), p);
                    //Klog.v(TAG, "X0: " + (x - 0));
                    recentX = x;
                }

                lastLevel = tideLevel;
            }

            // Just fill in the gap since we don't have a value for midnight at the end.
            Double xEnd = originX + (tideDataArray.length() * 4.5);
            canvas.drawLine(xEnd.intValue(),     originY, xEnd.intValue(),     originY - lastLevel.intValue(), p);
            canvas.drawLine(xEnd.intValue() - 1, originY, xEnd.intValue() - 1, originY - lastLevel.intValue(), p);
            canvas.drawLine(xEnd.intValue() - 2, originY, xEnd.intValue() - 2, originY - lastLevel.intValue(), p);
            canvas.drawLine(xEnd.intValue() - 3, originY, xEnd.intValue() - 3, originY - lastLevel.intValue(), p);
            canvas.drawLine(xEnd.intValue() - 4, originY, xEnd.intValue() - 4, originY - lastLevel.intValue(), p);
        } catch (JSONException e) {
            e.printStackTrace();
            Klog.e(TAG, "getbitmap JSON error:" + e.toString());
        }

        Calendar rightNow = Calendar.getInstance();
        int hour = rightNow.get(Calendar.HOUR_OF_DAY);
        int minute = rightNow.get(Calendar.MINUTE);

        p.setStrokeWidth(4f);
        p.setColor(Color.RED);
        int timeX = originX + (verticalGridSpacing * (hour * 60 + minute))/60;
        canvas.drawLine(timeX, originY, timeX, originY - (horizontalridLineCount * horizontalGridSpacing), p);

        Date now = new Date();
        String timeStr = new SimpleDateFormat("h:mm a").format(now);
        //p.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
        p.setColor(Color.argb(255, 0,0,255));
        p.setTextSize(32);
        //canvas.drawText(timeStr, width - 180, height - 20, p);

        return imageBitmap;
    }

    // Update the data that we need to draw the bitmap.  We really only want to get this once a day
    // and then use it over and over again.
    public void update() {

        long now = currentTimeMillis();
        if (now < nextUpdateTime) {
            return;
        }

        // regardless of we whether we succeed or not, don't update until 6AM tomorrow.
        // If we check too often, we get locked out.
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.DAY_OF_YEAR, 1);
        calendar.set(Calendar.HOUR_OF_DAY, 6); // Tomorrow at 6AM

        nextUpdateTime = calendar.getTimeInMillis();

        String dateStr = new SimpleDateFormat("MM-dd-yy").format(new Date());

        synchronized (lock) {
            // if the date is current and the JSONObject is not empty, we are all set.
            if (dateStr.equals(currentDateStr) && (tidesJSON.length() != 0)) {
                Klog.i(TAG, "updating - still matches: " + dateStr);
                return;
            }
        }
        Klog.i(TAG, "Updating: " + friendlyName + " at: " + dateStr + " for station: " + station);

        Date today = new Date();

        //String station = "8447270";

        String beginDateStr = new SimpleDateFormat("yyyyMMdd%2000:00").format(today);
        String endDateStr   = new SimpleDateFormat("yyyyMMdd%2023:54").format(today);

        String url = "https://tidesandcurrents.noaa.gov/api/datagetter?begin_date={0}&end_date={1}&station={2}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&application=faubel.org&format=json";
        url = url.replace("{0}", beginDateStr);
        url = url.replace("{1}", endDateStr);
        url = url.replace("{2}", station);

        // Loading the bytes could take many seconds.  Read to a temp buffer so we don't
        // prevent the UI thread from accessing the current good data
        // JSON is smaller than images but still limit it to 100KB
        JSONObject tempTidesJSON =  Utils.loadJSONFromURL(url);

        synchronized(lock) {
            // Now update tidesJSON quickly while preventing the UI thread from accessing it.
            if (tempTidesJSON != null) {
                tidesJSON = tempTidesJSON;
            } else {
                Klog.e(TAG, "tempTidesJSON was null");
                Klog.e(TAG, "url was: " + url);
                tidesJSON = new JSONObject();
            }
        }
    }
}
