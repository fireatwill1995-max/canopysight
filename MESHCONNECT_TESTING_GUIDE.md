# MeshConnect Integration - Testing Guide

## ✅ Completed Setup Steps

### 1. Database Migration ✅
- **Status**: Successfully completed
- **Command**: `npm run db:push` in `packages/database`
- **Result**: Database schema updated with:
  - `deviceType` field added to `Device` table
  - `MeshConnectConfig` table created
  - Prisma Client regenerated

### 2. Edge Agent Configuration ✅
- **Status**: Environment variables added
- **File**: `apps/edge-agent/.env`
- **Added Variables**:
  ```
  ENABLE_MESHCONNECT=false
  MESHCONNECT_DEVICE_ID=
  ```

## 🧪 Testing Instructions

### Step 1: Start Development Servers

**Terminal 1 - API Server:**
```bash
cd apps/api
npm run dev
```
API will run on: http://localhost:3001

**Terminal 2 - Web Application:**
```bash
cd apps/web
npm run dev
```
Web app will run on: http://localhost:3000

### Step 2: Create a Site (if needed)

1. Navigate to http://localhost:3000
2. Sign in (or use "Continue as Demo User")
3. Go to **Sites** page
4. Click **"+ Add Site"**
5. Fill in:
   - Name: "Test Site"
   - Description: "Test site for MeshConnect"
   - Address: "123 Test St"
   - Latitude: 40.7128
   - Longitude: -74.0060
6. Click **"Create Site"**
7. **Note the Site ID** from the URL or site detail page

### Step 3: Create a MeshConnect Device

1. Navigate to **Devices** page
2. Click **"+ Add Device"** button
3. Fill in the form:
   - **Name**: "MeshConnect Node 1"
   - **Site**: Select the site you created
   - **Device Type**: Select **"MeshConnect Node"** (important!)
   - **Serial Number**: "MC-001" (optional)
   - **Firmware Version**: "1.0.0" (optional)
   - **Status**: "offline" (default)
   - **IP Address**: "192.168.1.100" (optional)
   - **MAC Address**: "00:11:22:33:44:55" (optional)
4. Click **"Create Device"**
5. **Note the Device ID** from the device card or detail page

### Step 4: Configure MeshConnect Device

1. Click on the MeshConnect device you just created
2. You'll see the device detail page
3. Scroll down to find the **"MeshConnect Configuration"** panel
4. Configure the settings:
   - **Frequency Band**: Select "Dual Band" (or your preference)
   - **Throughput**: 100 (Mbps)
   - **Target Latency**: 7 (ms)
   - **Ethernet Ports**: 4
   - **Mesh Node ID**: Leave empty (auto-generated) or enter custom ID
   - **Parent Node ID**: Leave empty (for root node)
   - **Enable AES-256 Encryption**: Check the box
   - **Encryption Key**: Enter a secure key (optional, for new encryption)
   - **Enable Wi-Fi Access Point**: Check if needed
   - **Wi-Fi SSID**: "MeshConnect-AP" (if Wi-Fi enabled)
   - **Wi-Fi Password**: Enter password (if Wi-Fi enabled)
   - **Is Gateway Node**: Check if this is the gateway
   - **Gateway Address**: Leave empty if gateway, or enter gateway IP if not
5. Click **"Save Configuration"**
6. You should see a success message

### Step 5: View Mesh Topology

1. Navigate to the **Sites** page
2. Click on the site where you created the MeshConnect device
3. Click on the **"Mesh Network"** tab
4. You should see:
   - The MeshConnect node you created
   - Node status (will show "disconnected" initially)
   - Node ID
   - IP address (if configured)
   - Signal strength, latency, throughput (when connected)

### Step 6: Enable MeshConnect in Edge Agent (Optional)

1. Edit `apps/edge-agent/.env`
2. Set:
   ```
   ENABLE_MESHCONNECT=true
   MESHCONNECT_DEVICE_ID=<your-device-id-from-step-3>
   ```
3. Also set other required variables:
   ```
   DEVICE_ID=<your-camera-device-id>
   SITE_ID=<your-site-id>
   API_KEY=<your-api-key>
   ```
4. Start the edge agent:
   ```bash
   cd apps/edge-agent
   npm run dev
   ```
5. Check the logs for:
   - "✅ MeshConnect initialized and connected" (if successful)
   - Or "⚠️ Failed to initialize MeshConnect" (if there's an issue)

## 🎯 Expected Results

### Device Creation
- ✅ Device appears in Devices list
- ✅ Device shows "MeshConnect" badge
- ✅ Device detail page shows MeshConnect Configuration panel

### Configuration
- ✅ Configuration saves successfully
- ✅ Status panel shows current node status
- ✅ Settings persist after page refresh

### Topology View
- ✅ Mesh Network tab appears on site detail page
- ✅ Node appears in topology view
- ✅ Node information displays correctly
- ✅ Status updates (when edge agent is running)

### Edge Agent Integration
- ✅ Edge agent starts without errors
- ✅ MeshConnect initializes (if enabled and configured)
- ✅ Status updates sent to API every 30 seconds
- ✅ Topology updates visible in web UI

## 🔍 Verification Checklist

- [ ] Database migration completed successfully
- [ ] Can create MeshConnect device
- [ ] Device type selector shows "MeshConnect Node" option
- [ ] MeshConnect Configuration panel appears on device detail page
- [ ] Can save MeshConnect configuration
- [ ] Mesh Network tab appears on site detail page
- [ ] Topology view shows MeshConnect nodes
- [ ] Edge agent environment variables configured
- [ ] Edge agent can initialize MeshConnect (when enabled)

## 🐛 Troubleshooting

### Device Creation Issues
- **Problem**: Device type selector not showing MeshConnect option
  - **Solution**: Clear browser cache, refresh page, check that database migration ran

### Configuration Not Saving
- **Problem**: Error when saving configuration
  - **Solution**: Check browser console for errors, verify API is running, check database connection

### Topology Not Showing
- **Problem**: Mesh Network tab shows "No MeshConnect nodes found"
  - **Solution**: Verify device type is set to "meshconnect", check site ID matches

### Edge Agent Not Connecting
- **Problem**: Edge agent shows "Failed to initialize MeshConnect"
  - **Solution**: 
    - Verify `MESHCONNECT_DEVICE_ID` is correct
    - Check that MeshConnect configuration exists in database
    - Verify API is accessible from edge agent
    - Check API logs for errors

## 📊 API Testing

You can also test the API endpoints directly:

### Get MeshConnect Config
```bash
curl -X GET "http://localhost:3001/trpc/meshconnect.getConfig?input=%7B%22deviceId%22%3A%22YOUR_DEVICE_ID%22%7D"
```

### Get Mesh Topology
```bash
curl -X GET "http://localhost:3001/trpc/meshconnect.getTopology?input=%7B%22siteId%22%3A%22YOUR_SITE_ID%22%7D"
```

### List MeshConnect Devices
```bash
curl -X GET "http://localhost:3001/trpc/meshconnect.list?input=%7B%7D"
```

## ✅ Success Criteria

The integration is working correctly if:
1. ✅ You can create MeshConnect devices from the UI
2. ✅ Configuration panel appears and saves settings
3. ✅ Mesh topology view shows nodes
4. ✅ Edge agent can initialize MeshConnect (when configured)
5. ✅ No console errors in browser or server logs

## 📝 Notes

- MeshConnect hardware integration requires actual MeshConnect devices
- The current implementation provides the management interface
- Hardware-specific API calls are marked with `TODO` comments
- Network topology updates every 30 seconds
- Status updates are sent to the API every 30 seconds when edge agent is running
