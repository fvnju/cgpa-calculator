import { type Course } from "./columns";

export function CSVDownloader<Entry extends Course>(
  data: Entry[],
  fileName: string,
) {
  // Function to convert array of objects to CSV string
  function convertToCSV(data: Entry[]): string {
    if (data.length === 0) return "";

    const headers: (keyof Entry)[] = ["course", "credit", "grade"];
    const csvRows: string[] = [headers.join(",")]; // Add headers as the first row

    // Add data rows
    data.forEach((row) => {
      if (row.selected) {
        const values = headers.map((header) => {
          const value = row[header] ?? ""; // Handle undefined/null values
          return `"${value.toString().replace(/"/g, '""')}"`; // Escape double quotes
        });
        csvRows.push(values.join(","));
      }
    });

    return csvRows.join("\n");
  }

  // Function to trigger file download
  function downloadCSV(data: Entry[], fileName: string): void {
    const csvContent = convertToCSV(data);

    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    // Create a temporary anchor element to trigger the download
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName); // Set the desired file name
    link.style.visibility = "hidden"; // Hide the link
    document.body.appendChild(link);

    // Programmatically click the link to start the download
    link.click();

    // Clean up // TODO: rewrite it later using the using keyword
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Button click handler
  function handleDownload(): void {
    const downloadName = fileName || "data.csv";
    downloadCSV(data, downloadName);
  }

  // return function
  return handleDownload();
}
