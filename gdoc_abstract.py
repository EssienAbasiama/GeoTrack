# -*- coding: utf-8 -*-
"""Insert an Abstract directly into the GeoTrack Google Doc, matching the
Chapter 4-5 style pattern (Times New Roman; HEADING_2 named style; body 12pt
regular with 6pt spacing-after; major heading 14pt bold centred).

Phase 1 (probe):   python gdoc_abstract.py --probe   -> read-only, prints where
                    Chapter One starts and confirms the Ch4 body style.
Phase 2 (insert):  python gdoc_abstract.py            -> performs the edit.

Edit scope requires one browser approval the first time (token cached).
"""
import argparse
import os
import sys

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/documents"]
CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".config", "gws")
CLIENT_SECRET = os.path.join(CONFIG_DIR, "client_secret.json")
TOKEN = os.path.join(CONFIG_DIR, "token_docs.json")
DOC_ID = "1GNi0PWMbaLb0-gxIBCknPCtv-VXiFR4BKhf8V7zNyC8"

FONT = "Times New Roman"
HEADING_PT = 14
BODY_PT = 12

ABSTRACT = [
    "Accurate attendance monitoring remains a persistent challenge in academic "
    "institutions, where conventional manual and basic digital methods are "
    "vulnerable to impersonation (proxy attendance), location fraud, and the "
    "inability to confirm a student's continued presence throughout a lecture. "
    "This project presents the design and implementation of GeoTrack, a "
    "geo-fenced mobile attendance monitoring system that integrates four "
    "independent verification mechanisms (device binding, GPS-based geofencing, "
    "facial verification, and a lecturer-controlled timed attendance window with "
    "randomised presence checks) so that attendance is recorded only when a "
    "genuine, physically present, and correctly identified student checks in from "
    "a registered device.",
    "The system was developed as a three-tier client-server application "
    "comprising a cross-platform React Native mobile application, a Laravel "
    "RESTful backend, and a relational database, communicating securely over "
    "HTTPS. A student's position is determined by averaging multiple "
    "high-accuracy GNSS samples and evaluated against circular or polygonal venue "
    "boundaries using the Haversine and ray-casting algorithms, while identity is "
    "confirmed through facial verification against a configurable similarity "
    "threshold.",
    "The implemented system was evaluated through functional and performance "
    "testing covering positioning accuracy, face-verification reliability, "
    "device-binding enforcement, and the composite check-in decision under both "
    "legitimate and fraudulent conditions. Results showed accurate geofence "
    "admission outside the GPS-margin zone, reliable rejection of impersonation "
    "and location-spoofing attempts, correct on-time and late classification, "
    "prompt push and email notifications, and stable operation under continuous "
    "and concurrent use. GeoTrack therefore demonstrates a secure, "
    "cost-effective, and engineering-driven solution that eliminates common "
    "attendance fraud while providing real-time monitoring and analytics for "
    "lecturers and administrators.",
]


def get_service():
    creds = None
    if os.path.exists(TOKEN):
        creds = Credentials.from_authorized_user_file(TOKEN, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            print("Opening browser for Google sign-in (EDIT access this time)...")
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN, "w", encoding="utf-8") as fh:
            fh.write(creds.to_json())
    return build("docs", "v1", credentials=creds)


def para_text(el):
    if "paragraph" not in el:
        return ""
    return "".join(
        e.get("textRun", {}).get("content", "")
        for e in el["paragraph"]["elements"]
    )


def find_chapter_one(content):
    for el in content:
        if para_text(el).strip().upper().startswith("CHAPTER ONE"):
            return el
    return None


def probe(service):
    doc = service.documents().get(documentId=DOC_ID).execute()
    content = doc["body"]["content"]
    ch1 = find_chapter_one(content)
    print(f"Document: {doc.get('title')!r}")
    if not ch1:
        print("!! Could not find 'CHAPTER ONE'."); return
    idx = ch1["startIndex"]
    print(f"CHAPTER ONE starts at index {idx}")
    print("--- 6 paragraphs leading up to CHAPTER ONE ---")
    near = [el for el in content if "paragraph" in el and el["startIndex"] <= idx]
    for el in near[-6:]:
        ns = el["paragraph"].get("paragraphStyle", {}).get("namedStyleType", "?")
        print(f'  @{el["startIndex"]:5d} [{ns:14s}] {para_text(el).strip()[:60]}')
    # confirm Ch4 body style
    print("--- Chapter 4 reference body style ---")
    hit = False
    for el in content:
        if "paragraph" not in el:
            continue
        t = para_text(el).strip()
        if t.upper().startswith("CHAPTER FOUR"):
            hit = True
            continue
        if hit and len(t) > 80:
            ns = el["paragraph"].get("paragraphStyle", {}).get("namedStyleType", "?")
            ts = next((r["textRun"]["textStyle"] for r in el["paragraph"]["elements"]
                       if r.get("textRun")), {})
            keep = {k: ts.get(k) for k in ("bold", "fontSize", "weightedFontFamily")}
            print(f"  namedStyle={ns}  textStyle={keep}")
            break


def build_requests(insert_index):
    text = "ABSTRACT\n" + "\n".join(ABSTRACT) + "\n"
    pieces = ["ABSTRACT"] + ABSTRACT
    segs = []
    cur = insert_index
    for piece in pieces:
        segs.append((cur, cur + len(piece)))
        cur += len(piece) + 1
    chapter_one_new = insert_index + len(text)

    def pt(n):
        return {"magnitude": n, "unit": "PT"}

    reqs = [{"insertText": {"location": {"index": insert_index}, "text": text}}]

    # Heading "ABSTRACT": HEADING_2, centred, page break before, 14pt bold TNR
    h_s, h_e = segs[0]
    reqs.append({"updateParagraphStyle": {
        "range": {"startIndex": h_s, "endIndex": h_e},
        "paragraphStyle": {"namedStyleType": "HEADING_2", "alignment": "CENTER",
                            "pageBreakBefore": True,
                            "spaceBelow": pt(6)},
        "fields": "namedStyleType,alignment,pageBreakBefore,spaceBelow",
    }})
    reqs.append({"updateTextStyle": {
        "range": {"startIndex": h_s, "endIndex": h_e},
        "textStyle": {"bold": True, "fontSize": pt(HEADING_PT),
                      "weightedFontFamily": {"fontFamily": FONT}},
        "fields": "bold,fontSize,weightedFontFamily",
    }})

    # Body paragraphs: HEADING_2 named style, 12pt regular TNR, 6pt after.
    # Alignment is left unset so it inherits the style default exactly like the
    # Chapter 4-5 body paragraphs do.
    for s, e in segs[1:]:
        reqs.append({"updateParagraphStyle": {
            "range": {"startIndex": s, "endIndex": e},
            "paragraphStyle": {"namedStyleType": "HEADING_2", "spaceBelow": pt(6)},
            "fields": "namedStyleType,spaceBelow",
        }})
        reqs.append({"updateTextStyle": {
            "range": {"startIndex": s, "endIndex": e},
            "textStyle": {"bold": False, "fontSize": pt(BODY_PT),
                          "weightedFontFamily": {"fontFamily": FONT}},
            "fields": "bold,fontSize,weightedFontFamily",
        }})

    # Keep CHAPTER ONE on its own page after the abstract
    reqs.append({"updateParagraphStyle": {
        "range": {"startIndex": chapter_one_new, "endIndex": chapter_one_new + 1},
        "paragraphStyle": {"pageBreakBefore": True},
        "fields": "pageBreakBefore",
    }})
    return reqs


def insert(service):
    doc = service.documents().get(documentId=DOC_ID).execute()
    ch1 = find_chapter_one(doc["body"]["content"])
    if not ch1:
        sys.exit("Could not find CHAPTER ONE; aborting.")
    idx = ch1["startIndex"]
    print(f"Inserting Abstract before CHAPTER ONE (index {idx})...")
    reqs = build_requests(idx)
    service.documents().batchUpdate(
        documentId=DOC_ID, body={"requests": reqs}
    ).execute()
    print("Done. Abstract inserted into the Google Doc.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", action="store_true")
    args = ap.parse_args()
    service = get_service()
    if args.probe:
        probe(service)
    else:
        insert(service)


if __name__ == "__main__":
    main()
