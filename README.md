# DataShare

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/satyamahesh03/dataShare/pulls)
[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.png?v=103)](https://github.com/ellerbrock/open-source-badges/)

A complete full-stack web application designed for secure text and file sharing. This platform allows users to safely upload multiple files and encrypted messages using a unique code with password protection. It also features a built-in peer-to-peer (P2P) functionality for direct, fast transfer of files without any cloud storage footprint, along with an automated cleanup system for expired database and cloud shares.

## Features
- **Secure File & Text Sharing:** Safely share encrypted messages and upload multiple files using unique codes and optional password protection.
- **Real-Time P2P Transfers:** Direct peer-to-peer (P2P) file sharing for sending files instantly to a connected receiver without passing through server storage.
- **Automated Expired Cleanup:** An automated system that deletes expired files from cloud storage and the database to maintain a clean platform.

## Usage

DataShare offers a simple and intuitive interface for sharing files and text. Here's a quick guide on how to use it:

1. **Upload Files & Text:** 
   - Click on the upload area to select files or drag and drop them.
   - Add any secret text messages you want to share.
   - (Optional) Set a password for extra security.
   - Click "Share" to generate a unique 6-digit code.

2. **Receive Files & Text:**
   - Go to the "Receive" section.
   - Enter the 6-digit code provided by the sender.
   - If a password was set, you will be prompted to enter it.
   - Download the files or copy the text message.

3. **P2P Transfer (Direct Share):**
   - Navigate to the "P2P Transfer" section for direct device-to-device sharing.
   - Share your unique Peer ID with the receiver or connect using their ID.
   - Once connected, transfer files instantly without server limits!

## Project Structure

This project is structured as a Monorepo containing two main directories:
- `/client`: The complete React frontend application.
- `/server`: The Express + Node.js backend API and Server.

## Prerequisites

Make sure you have the following installed on your machine:
- Node.js (v16.0 or higher recommended)
- npm (Node Package Manager)

### For Open Source Contributors
To run this project locally, you will need to set up your own free-tier accounts for the database and storage services:
1. **MongoDB:** Create a free shared cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) to get your `MONGODB_URI` connection string.
2. **Cloudinary:** Create a free account at [Cloudinary](https://cloudinary.com/) to get your `Cloud Name`, `API Key`, and `API Secret`.
3. **AWS S3 (Required!):** Because this application handles files up to 1GB, AWS S3 is required. You will need an AWS account and an S3 bucket to get your `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

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

## Contributing

First off, thank you for considering contributing to DataShare! Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

Also, check out our [CONTRIBUTORS.md](CONTRIBUTORS.md) list. If you make a contribution, feel free to add your name there!

### How Can I Contribute?

#### Reporting Bugs
- **Check existing issues:** Ensure the bug was not already reported by searching on GitHub under [Issues](https://github.com/satyamahesh03/dataShare/issues).
- **Open a new issue:** If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/satyamahesh03/dataShare/issues/new). 
- **Be descriptive:** Include a clear title and description, as much relevant information as possible, and steps to reproduce the expected behavior that is not occurring.

#### Suggesting Enhancements
- **Check existing issues:** See if your enhancement has already been suggested.
- **Open a new issue:** Open a new issue with the tag `enhancement`.
- **Provide context:** Provide a clear and detailed explanation of the feature you want and why it's important or useful for the project.

#### Pull Requests
Please follow these steps to have your contribution considered by the maintainers:
1. **Fork the Project:** Fork the repository to your own GitHub account.
2. **Create your Feature Branch:** (`git checkout -b feature/AmazingFeature`)
3. **Commit your Changes:** (`git commit -m 'feat: Add some AmazingFeature'`)
4. **Push to the Branch:** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request:** Go to the original repository and open a Pull Request. Provide a detailed description of your changes.

### Styleguides

#### Commit Messages
We encourage the use of [Conventional Commits](https://www.conventionalcommits.org/).
- Prefix your commits with type (e.g., `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- Use the present tense ("Add feature" not "Added feature").
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...").

#### Code Style
- Ensure you run `npm run lint` or format your code using the existing Prettier/ESLint configuration in the project before committing.
- Keep components small and reusable in the React client.
- Comment your code, especially where the logic is complex.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact / Support

If you have any questions, issues, or feature requests, please [open an issue](https://github.com/satyamahesh03/dataShare/issues) in the repository.
