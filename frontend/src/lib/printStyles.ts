export const commonPrintStyles = String.raw`
  @page {
    size: portrait;
    margin: 8mm 10mm !important;
  }
  @media print {
    body, html {
      background-color: white !important;
      color: black !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
    }
    /* Hide sidebar, header, navigation, and everything not related to print */
    aside, .dash-sidebar, .dash-desktop-header, .dash-mobile-header, .dash-overlay,
    .print\:hidden, .no-print, header, nav, footer, .dash-page-header, .dash-page-actions {
      display: none !important;
    }
    /* Reset dashboard layout wrapper to display: block on print */
    .dash-layout, .dash-main {
      display: block !important;
      width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
    }
    .print-container {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 2px 6px !important;
      box-shadow: none !important;
      border: none !important;
      background: white !important;
      font-size: 11px !important;
    }
    .excel-table {
      border: 1.5px solid #000 !important;
      border-collapse: collapse !important;
    }
    .excel-table th, .excel-table td {
      border: 1px solid #000 !important;
      padding: 4px 8px !important;
    }
    .bg-\[#D9E1F2\] {
      background-color: #D9E1F2 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;
