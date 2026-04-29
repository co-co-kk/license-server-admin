@echo off
setlocal

set IMAGE_NAME=license-server-admin
set IMAGE_TAG=latest
set TAR_FILE=%IMAGE_NAME%.tar

echo === Step 1: Building Docker image ===
docker build -t %IMAGE_NAME%:%IMAGE_TAG% .
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

echo.
echo === Step 2: Saving image to %TAR_FILE% ===
docker save %IMAGE_NAME%:%IMAGE_TAG% -o %TAR_FILE%
if errorlevel 1 (
    echo Save failed!
    exit /b 1
)

echo.
echo === Done ===
echo Image saved to: %CD%\%TAR_FILE%
echo.
echo Upload to server with:
echo   scp %TAR_FILE% user@your-server:/tmp/
echo Then run deploy.sh on the server.
