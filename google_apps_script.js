function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      data = e.parameter;
    }

    var action = data.action;
    var sheetId = "1PXRagE_Muf_hzhNgiHES_Qpj8kStBn4wadGMSBsaiuE";
    var driveFolderId = "1yZ1tXOSsTavtXjYGEy-Ja04tG5_qdfUq";

    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheets()[0];

    if (action === "register") {
      return registerUser(data, sheet, driveFolderId);
    } else if (action === "login") {
      return loginUser(data, sheet);
    } else if (action === "updateUser") {
      return updateUser(data, sheet);
    } else if (action === "updateStatus") {
      data.updates = { accountStatus: "Active" };
      return updateUser(data, sheet);
    } else {
      return createResponse({ status: "error", message: "Invalid action" });
    }

  } catch (e) {
    return createResponse({ status: "error", message: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = e.parameter.action;
  var sheetId = "1PXRagE_Muf_hzhNgiHES_Qpj8kStBn4wadGMSBsaiuE";
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheets()[0];

  if (action === "getUsers") {
    return getUsers(sheet);
  } else if (action === "adminAuth") {
    if (e.parameter.key === "admin123") {
      return createResponse({ status: "success" });
    } else {
      return createResponse({ status: "error" });
    }
  }

  return createResponse({ status: "working", message: "Get request received." });
}

// --- ACTIONS ---

// NEW COLUMN STRUCTURE:
// 0: Timestamp
// 1: Username
// 2: Role
// 3: Name
// 4: Email
// 5: WA
// 6: Package
// 7: Details
// 8: Status
// 9: Proof

function getUsers(sheet) {
  var data = sheet.getDataRange().getValues();
  var users = [];

  // Start from 1 to skip header
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    users.push({
      timestamp: row[0], // Date
      username: row[1],
      role: row[2],
      name: row[3],
      email: row[4],
      wa: row[5],
      package: row[6],
      details: row[7],
      status: row[8],
      proof: row[9]
    });
  }

  return createResponse(users);
}

function registerUser(data, sheet, folderId) {
  var users = sheet.getDataRange().getValues();
  for (var i = 1; i < users.length; i++) {
    // Check Username at index 1
    if (String(users[i][1]) === String(data.username)) {
      return createResponse({ status: "error", message: "Username already exists" });
    }
  }

  var fileUrl = "";
  if (data.fileData && data.fileName) {
    var folder = DriveApp.getFolderById(folderId);
    var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.mimeType, data.fileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    fileUrl = file.getUrl();
  }

  // Prepend new Date() for timestamp
  var row = [
    new Date(),
    data.username,
    data.role,
    data.fullName,
    data.email,
    "'" + data.wa,
    data.packageTier,
    data.packageDetails || "-",
    "Pending",
    fileUrl
  ];

  sheet.appendRow(row);
  return createResponse({ status: "success", message: "Registration successful" });
}

function loginUser(data, sheet) {
  var users = sheet.getDataRange().getValues();

  for (var i = 1; i < users.length; i++) {
    var row = users[i];
    // Col 1: Username, Col 5: WA (Password)
    if (String(row[1]).toLowerCase() === String(data.username).toLowerCase() &&
      String(row[5]).replace(/[^0-9]/g, '') === String(data.password).replace(/[^0-9]/g, '')) {

      return createResponse({
        status: "success",
        data: {
          username: row[1],
          role: row[2],
          name: row[3],
          email: row[4],
          wa: row[5],
          package: row[6],
          packageDetails: row[7],
          accountStatus: row[8],
          access: determineAccess(row[6], row[7])
        }
      });
    }
  }
  return createResponse({ status: "error", message: "Invalid username or password" });
}

function updateUser(data, sheet) {
  var users = sheet.getDataRange().getValues();
  var rowIndex = -1;

  // Find row by Username (Index 1)
  for (var i = 1; i < users.length; i++) {
    if (users[i][1] == data.username) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) return createResponse({ status: "error", message: "User not found" });

  // Mapping:
  // 1: User, 2: Role, 3: Name, 4: Email, 5: WA, 6: Pkg, 7: Det, 8: Stat
  // Range starts at column 2 (index 1 + 1) to edit username? No, username is key.
  // Let's grab the whole row range including cols 1-9 (Username to Status)
  // Actually, Timestamp is Col 1. Username is Col 2.
  // We want to update from Role (Col 3) onwards mostly, but let's allow updating everything except timestamp.
  // getRange(row, column, numRows, numColumns)
  // Timestamp is col 1. We want to update cols 2 (Username) through 9 (Status)?
  // Wait, row array was: [Time, User, Role, Name, Email, WA, Pkg, Det, Stat, Proof]
  // Indices:             0      1     2     3     4      5   6    7    8     9
  // Columns (1-based):   1      2     3     4     5      6   7    8    9     10

  // We update cols 2 to 9 usually.
  // Let's just get the range for Col 2 (Username) to Col 9 (Status).

  var range = sheet.getRange(rowIndex, 2, 1, 8); // Cols 2 to 9 (8 cols)
  var currentRow = range.getValues()[0];

  // currentRow[0] = Username (Col 2)
  // currentRow[1] = Role (Col 3) ...

  if (data.role) currentRow[1] = data.role;
  if (data.name) currentRow[2] = data.name;
  if (data.email) currentRow[3] = data.email;
  if (data.wa) currentRow[4] = "'" + data.wa;
  if (data.package) currentRow[5] = data.package;
  if (data.details) currentRow[6] = data.details;
  if (data.status) currentRow[7] = data.status;

  range.setValues([currentRow]);

  return createResponse({ status: "success", message: "User updated" });
}

function determineAccess(packageTier, packageDetails) {
  if (String(packageTier).toLowerCase() === 'gold') {
    return ['ALL'];
  } else {
    return [packageDetails];
  }
}

function createResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
