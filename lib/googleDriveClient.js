const { google } = require('googleapis');

function getDriveClient() {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const redirectUri = process.env.OAUTH_REDIRECT_URI;
  const refreshToken = process.env.REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error('No REFRESH_TOKEN set in environment. Authenticate first.');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function ensureFolder(drive, parentId, folderName) {
  const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (res.data.files.length > 0) return res.data.files[0].id;

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return folder.data.id;
}

async function uploadFile(drive, folderId, fileName, buffer, mimeType) {
  const { Readable } = require('stream');
  const stream = Readable.from(buffer);

  return await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });
}

const refreshToken = process.env.REFRESH_TOKEN;
if (!refreshToken) throw new Error("No REFRESH_TOKEN env variable set");
oauth2Client.setCredentials({ refresh_token: refreshToken });


module.exports = { getDriveClient, ensureFolder, uploadFile };
