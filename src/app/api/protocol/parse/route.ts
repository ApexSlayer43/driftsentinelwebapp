import { NextRequest, NextResponse } from "next/server";

// pdf-parse v1 has no type declarations
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No PDF file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file instanceof File ? file.name : "upload.pdf";
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum 10MB." },
        { status: 400 }
      );
    }

    // Convert Blob to Buffer for pdf-parse v1
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text using pdf-parse v1: pdfParse(buffer) → { text, numpages, info }
    const result = await pdfParse(buffer);

    return NextResponse.json({
      text: result.text,
      pages: result.numpages,
    });
  } catch (err: unknown) {
    console.error("PDF parse error:", err);
    return NextResponse.json(
      {
        error: "Failed to parse PDF",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
