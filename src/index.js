import {
  downloadExcelFileToBuffer,
  convertFileIntoAirTable,
} from "./util/index.js";
export const handler = async (event) => {
  const excelFile = event?.excel_file;
  try {
    if (!excelFile) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: "Missing excel_file query parameter",
      };
    }
    const buffer = await downloadExcelFileToBuffer(excelFile);
    const rows = await convertFileIntoAirTable(buffer);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows,
        Address: process.env.ADDRESS_BASE_ID,
        Phone: process.env.PHONE_BASE_ID,
        Base_id: process.env.BASE_ID,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: error.toString(),
    };
  }
};
