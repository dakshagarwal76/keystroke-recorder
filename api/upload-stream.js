export const config = {
  runtime: 'edge', // Use Edge runtime for streaming
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const fileName = formData.get('fileName');
    const participantId = formData.get('participantId');
    const session = formData.get('session');
    const person = formData.get('person');
    const deviceId = formData.get('deviceId');
    const gender = formData.get('gender');
    const handedness = formData.get('handedness');

    if (!file || !fileName) {
      return new Response(JSON.stringify({ error: 'Missing file or fileName' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Streaming upload: ${fileName}, size: ${file.size} bytes`);

    // Get Google Drive access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        refresh_token: process.env.REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });

    const { access_token } = await tokenResponse.json();

    // Create folder structure
    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    
    // Helper to ensure folder
    async function ensureFolder(parentId, folderName) {
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}'+and+'${parentId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id)`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });
      const searchData = await searchRes.json();
      
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
      
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        })
      });
      
      const createData = await createRes.json();
      return createData.id;
    }

    // Create folder structure: U001/Person_1/Session_1/
    const participantFolderId = await ensureFolder(rootFolderId, participantId);
    const personFolderId = await ensureFolder(participantFolderId, `Person_${person}`);
    const sessionFolderId = await ensureFolder(personFolderId, `Session_${session}`);

    // Upload file using resumable upload
    const metadata = {
      name: fileName,
      parents: [sessionFolderId]
    };

    const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    const uploadUrl = initResponse.headers.get('Location');

    // Stream file to Google Drive
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip'
      },
      body: file.stream(),
      duplex: 'half'
    });

    const uploadResult = await uploadResponse.json();

    console.log('✅ Upload successful:', uploadResult.id);

    return new Response(JSON.stringify({
      success: true,
      fileId: uploadResult.id,
      fileName: uploadResult.name,
      folder: `${participantId}/Person_${person}/Session_${session}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
