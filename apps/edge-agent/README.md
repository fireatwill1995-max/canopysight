# Edge Agent

Raspberry Pi edge computing software for Canopy Sight.

## Features

- Camera capture (V4L2/libcamera)
- AI detection (YOLOv8/v9)
- Multi-object tracking
- Zone breach detection
- Risk scoring
- Event packaging & upload

## Setup

1. Install dependencies: `npm install`
2. Configure environment variables (see `.env.example`)
3. Run: `npm run dev`

## Hardware Requirements

- Raspberry Pi 4 or newer
- USB camera or Raspberry Pi Camera Module
- 4G/5G modem (optional, for remote sites)
