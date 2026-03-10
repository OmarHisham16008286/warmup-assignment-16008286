const fs = require("fs");
// Converts "hh:mm:ss am" or "hh:mm:ss pm" to total seconds since midnight
function timeToSeconds(timeStr) {
    timeStr = timeStr.trim().toLowerCase();

    let isPM = timeStr.indexOf("pm") !== -1;
    let isAM = timeStr.indexOf("am") !== -1;

    timeStr = timeStr.replace("am", "").replace("pm", "").trim();

    let parts   = timeStr.split(":");
    let hours   = Number(parts[0]);
    let minutes = Number(parts[1]);
    let seconds = Number(parts[2]);

    if (isPM && hours !== 12) hours = hours + 12;
    if (isAM && hours === 12) hours = 0;

    return hours * 3600 + minutes * 60 + seconds;
}

// Converts "h:mm:ss" duration string to total seconds
function durationToSeconds(durStr) {
    durStr      = durStr.trim();
    let parts   = durStr.split(":");
    let hours   = Number(parts[0]);
    let minutes = Number(parts[1]);
    let seconds = Number(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
}

// Converts total seconds back to "h:mm:ss" string
function secondsToString(totalSeconds) {
    let hours   = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;

    let mm = String(minutes).padStart(2, "0");
    let ss = String(seconds).padStart(2, "0");

    return hours + ":" + mm + ":" + ss;
}

// Reads shifts.txt and returns all data lines (skips the header row)
function getLines(filePath) {
    let content  = fs.readFileSync(filePath, { encoding: "utf8" });
    let allLines = content.split("\n");
    let result   = [];
    for (let i = 1; i < allLines.length; i++) {
        let line = allLines[i].trim();
        if (line !== "") {
            result.push(line);
        }
    }
    return result;
}

// Reads driverRates.txt and returns all lines (no header to skip)
function getRateLines(filePath) {
    let content  = fs.readFileSync(filePath, { encoding: "utf8" });
    let allLines = content.split("\n");
    let result   = [];
    for (let i = 0; i < allLines.length; i++) {
        let line = allLines[i].trim();
        if (line !== "") {
            result.push(line);
        }
    }
    return result;
}
// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
      let startSec = timeToSeconds(startTime);
    let endSec   = timeToSeconds(endTime);
    let diffSec  = endSec - startSec;

        if (diffSec < 0) {
        diffSec = diffSec + 24 * 3600;
    }
    return secondsToString(diffSec);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    let deliveryStart = 8  * 3600;   // 8:00 AM in seconds
    let deliveryEnd   = 22 * 3600;   // 10:00 PM in seconds

    let startSec = timeToSeconds(startTime);
    let endSec   = timeToSeconds(endTime);
    let idleSec  = 0;

    // Time before 8 AM is idle
    if (startSec < deliveryStart) {
        // Idle period ends when delivery starts, or when shift ends (whichever is earlier)
        let idleEnds = deliveryStart;
        if (endSec < deliveryStart) idleEnds = endSec;
        idleSec = idleSec + (idleEnds - startSec);
}
 // Time after 10 PM is idle
    if (endSec > deliveryEnd) {
        // Idle period starts when delivery ends, or when shift starts (whichever is later)
        let idleStarts = deliveryEnd;
        if (startSec > deliveryEnd) idleStarts = startSec;
        idleSec = idleSec + (endSec - idleStarts);
    }

    return secondsToString(idleSec);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    let shiftSec  = durationToSeconds(shiftDuration);
    let idleSec   = durationToSeconds(idleTime);
    let activeSec = shiftSec - idleSec;
    return secondsToString(activeSec);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    let normalQuota = 8 * 3600 + 24 * 60;  // 8h 24m in seconds
    let eidQuota    = 6 * 3600;             // 6h in seconds

    // Split the date string "yyyy-mm-dd" into year, month, day
    let dateParts = date.split("-");
    let year  = Number(dateParts[0]);
    let month = Number(dateParts[1]);
    let day   = Number(dateParts[2]);

    // Use eid quota if date falls within Eid al-Fitr 2025
    let quota = normalQuota;
    if (year === 2025 && month === 4 && day >= 10 && day <= 30) {
        quota = eidQuota;
    }

    let activeSec = durationToSeconds(activeTime);
    return activeSec >= quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
let driverID   = shiftObj.driverID;
    let driverName = shiftObj.driverName;
    let date       = shiftObj.date;
    let startTime  = shiftObj.startTime;
    let endTime    = shiftObj.endTime;

    // Read the raw file content (keeping header and all lines)
    let rawContent = fs.readFileSync(textFile, { encoding: "utf8" });
    let allLines   = rawContent.split("\n");

    // Check for a duplicate: same driverID AND same date
    for (let i = 1; i < allLines.length; i++) {
        let line = allLines[i].trim();
        if (line === "") continue;
        let cols = line.split(",");
        if (cols[0].trim() === driverID && cols[2].trim() === date) {
            return {};  // duplicate found, return empty object
        }
    }

    // Calculate all derived fields using functions 1-4
    let shiftDuration = getShiftDuration(startTime, endTime);
    let idleTime      = getIdleTime(startTime, endTime);
    let activeTime    = getActiveTime(shiftDuration, idleTime);
    let quota         = metQuota(date, activeTime);
    let hasBonus      = false;

    // Build the new CSV line
    let newLine = driverID + "," + driverName + "," + date + "," +
                  startTime + "," + endTime + "," + shiftDuration + "," +
                  idleTime + "," + activeTime + "," + quota + "," + hasBonus;

   let lastIndexOfDriver = -1;
    for (let i = 1; i < allLines.length; i++) {
        let line = allLines[i].trim();
        if (line === "") continue;
        let cols = line.split(",");
        if (cols[0].trim() === driverID) {
            lastIndexOfDriver = i;
        }
    }

    if (lastIndexOfDriver !== -1) {
        // Insert right after the driver's last record
        allLines.splice(lastIndexOfDriver + 1, 0, newLine);
    } else {
        // New driver: remove trailing empty lines and then append
        while (allLines.length > 0 && allLines[allLines.length - 1].trim() === "") {
            allLines.pop();
        }
        allLines.push(newLine);
    }

    // Save the updated file
    fs.writeFileSync(textFile, allLines.join("\n"), { encoding: "utf8" });

    // Return the new record as a plain object
    return {
        driverID:      driverID,
        driverName:    driverName,
        date:          date,
        startTime:     startTime,
        endTime:       endTime,
        shiftDuration: shiftDuration,
        idleTime:      idleTime,
        activeTime:    activeTime,
        metQuota:      quota,
        hasBonus:      hasBonus
    };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
 let rawContent = fs.readFileSync(textFile, { encoding: "utf8" });
    let allLines   = rawContent.split("\n");

    for (let i = 1; i < allLines.length; i++) {
        let line = allLines[i].trim();
        if (line === "") continue;
        let cols = line.split(",");

        if (cols[0].trim() === driverID && cols[2].trim() === date) {
            cols[9]     = String(newValue);  // HasBonus is column index 9
            allLines[i] = cols.join(",");
            break;
        }
    }

    fs.writeFileSync(textFile, allLines.join("\n"), { encoding: "utf8" });}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
     let targetMonth = Number(month);  // works for both "04" and "4"

    let lines       = getLines(textFile);
    let driverFound = false;
    let bonusCount  = 0;

    for (let i = 0; i < lines.length; i++) {
        let cols = lines[i].split(",");

        if (cols[0].trim() !== driverID) continue;

        driverFound = true;

        // Date format is "yyyy-mm-dd", month is the middle part
        let dateParts   = cols[2].trim().split("-");
        let recordMonth = Number(dateParts[1]);

        if (recordMonth === targetMonth) {
            if (cols[9].trim() === "true") {
                bonusCount++;
            }
        }
    }

    if (driverFound === false) return -1;
    return bonusCount;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
let lines        = getLines(textFile);
    let totalSeconds = 0;

    for (let i = 0; i < lines.length; i++) {
        let cols = lines[i].split(",");

        if (cols[0].trim() !== driverID) continue;

        let dateParts   = cols[2].trim().split("-");
        let recordMonth = Number(dateParts[1]);

        if (recordMonth === month) {
            totalSeconds = totalSeconds + durationToSeconds(cols[7].trim()); // col 7 = ActiveTime
        }
    }

    return secondsToString(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
let normalQuota = 8 * 3600 + 24 * 60;   // 8h 24m in seconds
    let eidQuota    = 6 * 3600;              // 6h in seconds

    // Day names in order matching JavaScript's getDay() (0=Sunday ... 6=Saturday)
    let dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    // Read the driver's day off from the rates file
    let rateLines  = getRateLines(rateFile);
    let dayOffName = "";

    for (let i = 0; i < rateLines.length; i++) {
        let cols = rateLines[i].split(",");
        if (cols[0].trim() === driverID) {
            dayOffName = cols[1].trim().toLowerCase();
            break;
        }
    }

    // Find the day-of-week number that matches the driver's day off
    let dayOffNumber = -1;
    for (let i = 0; i < dayNames.length; i++) {
        if (dayNames[i] === dayOffName) {
            dayOffNumber = i;
            break;
        }
    }

    // Loop through shift records and add up required hours
    let shiftLines       = getLines(textFile);
    let totalRequiredSec = 0;

    for (let i = 0; i < shiftLines.length; i++) {
        let cols = shiftLines[i].split(",");

        if (cols[0].trim() !== driverID) continue;

        let dateParts = cols[2].trim().split("-");
        let year      = Number(dateParts[0]);
        let recMonth  = Number(dateParts[1]);
        let day       = Number(dateParts[2]);

        if (recMonth !== month) continue;

        // Find out which day of the week this date is
        let dateObj = new Date(year, recMonth - 1, day);
        let weekDay = dateObj.getDay();  // 0=Sun, 1=Mon, ..., 6=Sat

        // Skip if this is the driver's day off
        if (weekDay === dayOffNumber) continue;

        // Choose the correct daily quota
        let dailyQuota = normalQuota;
        if (year === 2025 && recMonth === 4 && day >= 10 && day <= 30) {
            dailyQuota = eidQuota;
        }

        totalRequiredSec = totalRequiredSec + dailyQuota;
    }

    // Subtract 2 hours for every bonus the driver earned this month
    let bonusReduction = bonusCount * 2 * 3600;
    totalRequiredSec   = totalRequiredSec - bonusReduction;
    if (totalRequiredSec < 0) totalRequiredSec = 0;

    return secondsToString(totalRequiredSec);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
let rateLines = getRateLines(rateFile);
    let basePay   = 0;
    let tier      = 0;

    for (let i = 0; i < rateLines.length; i++) {
        let cols = rateLines[i].split(",");
        if (cols[0].trim() === driverID) {
            basePay = Number(cols[2].trim());
            tier    = Number(cols[3].trim());
            break;
        }
    }

    let actualSec   = durationToSeconds(actualHours);
    let requiredSec = durationToSeconds(requiredHours);

    // No deduction if driver worked at least the required hours
    if (actualSec >= requiredSec) {
        return basePay;
    }

    // How many seconds short is the driver?
    let missingSec = requiredSec - actualSec;

    // Each tier allows a certain number of missing hours before any deduction
    let allowedHours = 0;
    if (tier === 1) allowedHours = 50;
    if (tier === 2) allowedHours = 20;
    if (tier === 3) allowedHours = 10;
    if (tier === 4) allowedHours = 3;

    // Remove the allowed buffer from missing time
    let allowedSec = allowedHours * 3600;
    missingSec     = missingSec - allowedSec;
    if (missingSec < 0) missingSec = 0;

    // Only complete hours are charged — ignore leftover minutes/seconds
    let missingFullHours = Math.floor(missingSec / 3600);

    // Calculate and apply the deduction
    let deductionPerHour = Math.floor(basePay / 185);
    let totalDeduction   = missingFullHours * deductionPerHour;

    return basePay - totalDeduction;
}
//tested and updated 2nd commit
module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
