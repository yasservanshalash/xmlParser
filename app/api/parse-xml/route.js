import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data.xml');
    const xmlData = await fs.readFile(filePath, 'utf-8');
    const jsonResult = await parseStringPromise(xmlData);
    return NextResponse.json(jsonResult);
  } catch (error) {
    console.error('Error parsing XML:', error);
    return NextResponse.json({ error: 'Failed to parse XML file' }, { status: 500 });
  }
}