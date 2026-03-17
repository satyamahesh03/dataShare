# DataShare

A complete full-stack web application designed for secure text and file sharing. This platform allows users to safely upload multiple files and encrypted messages using a unique code with password protection. It also features a built-in peer-to-peer (P2P) functionality for direct, fast transfer of files without any cloud storage footprint, along with an automated cleanup system for expired database and cloud shares.

## Features
- **Secure File & Text Sharing:** Safely share encrypted messages and upload multiple files using unique codes and optional password protection.
- **Real-Time P2P Transfers:** Direct peer-to-peer (P2P) file sharing for sending files instantly to a connected receiver without passing through server storage.
- **Automated Expired Cleanup:** An automated system that deletes expired files from cloud storage and the database to maintain a clean platform.

## Project Structure

This project is structured as a Monorepo containing two main directories:
- `/client`: The complete React frontend application.
- `/server`: The Express + Node.js backend API and Server.

## Prerequisites

Make sure you have the following installed on your machine:
- Node.js (v16.0 or higher recommended)
- npm (Node Package Manager)
- A MongoDB account and Cluster
- A Cloudinary account (for file storage)
- Optional: AWS S3 Account (if configured for alternative storage)

## Setup Guide

### 1. Database and Environment Configuration

First, you need to configure your backend environment variables to connect the server to your database and storage providers.

1. Navigate to the `server` directory.
2. Create a new file named `.env`.


```env
PORT=6500
MONGODB_URI=your_mongodb_connection_string_here
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name_here
CLOUDINARY_API_KEY=your_cloudinary_api_key_here
CLOUDINARY_API_SECRET=your_cloudinary_api_secret_here
CLOUDINARY_UPLOAD_PRESET=your_cloudinary_upload_preset_here

# AWS S3 Settings
AWS_REGION=your_aws_region_here
AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_S3_BUCKET_NAME=your_aws_s3_bucket_name_here
```

### 2. Backend (Server) Setup

Open a new terminal window and navigate to the project directory:

```bash
cd server
npm install
npm start
```
The backend server should now be running locally on `http://localhost:6500` (or whatever port you specified).

### 3. Frontend (Client) Setup

Open a **separate** new terminal window and navigate to the project directory:

```bash
cd client
npm install
npm run dev
```
The React frontend should now be running locally. Typically, Vite will start the frontend on `http://localhost:5173`. Open this URL in your browser to view the application!

## Testing the Application

1. Open your browser to the local Client URL.
2. Test out the upload features to ensure your `.env` storage configurations are hooked up correctly.
3. Open a second window to test out the P2P Transfer feature!
