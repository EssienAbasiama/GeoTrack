# -*- coding: utf-8 -*-
"""Export the GeoTrack final-year report from Google Docs to a local .docx.

Uses the OAuth Desktop credentials already created (client_secret.json).
On first run it opens a browser once for consent; the token is cached so
subsequent runs are silent. Read-only Drive scope.
"""
import io
import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".config", "gws")
CLIENT_SECRET = os.path.join(CONFIG_DIR, "client_secret.json")
TOKEN = os.path.join(CONFIG_DIR, "token.json")

DOC_ID = "1GNi0PWMbaLb0-gxIBCknPCtv-VXiFR4BKhf8V7zNyC8"
OUT = "GeoTrack_Report_export.docx"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def get_credentials() -> Credentials:
    creds = None
    if os.path.exists(TOKEN):
        creds = Credentials.from_authorized_user_file(TOKEN, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            print("Opening browser for Google sign-in... approve access as "
                  "essienabasiama11@gmail.com (click Advanced -> Go to "
                  "geotrack-docs if you see an 'unverified app' warning).")
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN, "w", encoding="utf-8") as fh:
            fh.write(creds.to_json())
    return creds


def main() -> None:
    creds = get_credentials()
    service = build("drive", "v3", credentials=creds)

    meta = service.files().get(fileId=DOC_ID, fields="name").execute()
    print(f"Exporting: {meta.get('name')!r}")

    request = service.files().export_media(fileId=DOC_ID, mimeType=DOCX_MIME)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _status, done = downloader.next_chunk()

    with open(OUT, "wb") as fh:
        fh.write(buf.getvalue())
    print(f"Saved {OUT} ({os.path.getsize(OUT):,} bytes)")


if __name__ == "__main__":
    main()
