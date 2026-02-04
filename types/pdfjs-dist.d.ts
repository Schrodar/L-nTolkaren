declare module 'pdfjs-dist/build/pdf.mjs' {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export type PDFTextItem = {
    str?: string;
    transform?: number[];
  };

  export type PDFTextContent = {
    items: PDFTextItem[];
  };

  export type PDFPageProxy = {
    getTextContent(): Promise<PDFTextContent>;
  };

  export type PDFDocumentProxy = {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  };

  export type PDFLoadingTask = {
    promise: Promise<PDFDocumentProxy>;
  };

  export function getDocument(src: { data: ArrayBuffer | Uint8Array }): PDFLoadingTask;
}
