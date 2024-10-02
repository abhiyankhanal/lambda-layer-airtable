module.exports.handler = async (event) => {
  let excelFile = JSON.parse(event?.body);
  excelFile = excelFile.excel_file;
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
    
    console.log("Downloading excel file to bufferr...");
    const buffer = await downloadExcelFileToBuffer(excelFile);
    console.log("Buffer here", buffer);

    console.log("Convert file to airtable");
    const rows = await convertFileIntoAirTable(buffer);
    console.log("Rows here", rows);

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

const Airtable = require("airtable");
const axios = require("axios");
const XLSX = require("xlsx");
const BATCH_SIZE = 10;

function areAllKeysUndefinedOrEmpty(obj) {
  return Object.values(obj).every(
    (value) =>
      value === undefined ||
      value === "" ||
      value === null ||
      value === "NaN" ||
      value === "undefined" ||
      value === "null"
  );
}
function filterEmptyKeys(obj) {
  const newObj = {};
  for (const key in obj) {
    if (
      obj[key] !== null &&
      obj[key] !== undefined &&
      obj[key] !== "" &&
      obj[key] !== "NaN" &&
      obj[key] !== "undefined" &&
      obj[key] !== "null" &&
      obj[key].length !== 0
    ) {
      newObj[key] = obj[key];
    }
  }
  return newObj;
}
function removeSpecialCharsAndConvertToNumber(str) {
  // Remove all characters except digits and the decimal point
  let cleanedString = (str + "").replace(/[^0-9.]/g, "");
  return parseFloat(cleanedString);
}
const convertToDynamicName = (initialName, LastName, index, isOne) => {
  return `${initialName}_${LastName}${isOne && index == 1 ? "" : `_${index}`}`;
};
async function downloadExcelFileToBuffer(url) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "arraybuffer", // Get a response as an ArrayBuffer
  });

  return Buffer.from(response.data); // Convert the ArrayBuffer to Buffer
}

async function processBufferFile(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const result = {};
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    result[sheetName] = XLSX.utils.sheet_to_json(sheet);
  });
  return result;
}

const batchCreate = async (table, records) => {
  const results = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try {
      const created = await table.create(batch);
      results.push(...created);
    } catch (error) {
      console.error(`Error creating batch: ${error.message}`);
      throw error;
    }
  }
  return results;
};

// Airtable configuration

const base = new Airtable({
  apiKey: process.env.API_KEY,
}).base(process.env.BASE_ID);
const addressTable = base(process.env.ADDRESS_BASE_ID);
const phoneTable = base(process.env.PHONE_BASE_ID);
const emailTable = base(process.env.EMAIL_BASE_ID);
const propertyTable = base(process.env.PROPERTY_BASE_ID);
const propertyHoldingCompanyTable = base(
  process.env.PROPERTY_HOLDING_COMPANY_BASE_ID
);
const contactTable = base(process.env.CONTACT_BASE_ID);
async function convertFileIntoAirTable(buffer) {
  const result = await processBufferFile(buffer);
  const jsonArray = result.properties;

  const rows = [];
  for (const iterator of jsonArray) {
    try {
      console.log("Processing row", iterator);
      const row = {};
      const propertyAddress = {
        type: "Property",
        street: iterator.address_line_1,
        city: iterator.address_city,
        state: iterator.address_state,
        zip: iterator.address_postal_code + "",
        county: iterator.county,
        country: "United States",
        longitude: +iterator.longitude,
        latitude: +iterator.latitude,
      };
      let res = await addressTable.create(filterEmptyKeys(propertyAddress));
      const propertyAddressId = res.getId();

      const propertyHoldingCompanyAddress = {
        type: "Registered Agent",
        street: iterator.reported_mailing_address_line_1,
        city: iterator.reported_mailing_address_city,
        state: iterator.reported_mailing_address_state,
        zip: iterator.reported_mailing_address_postal_code + "",
        county: iterator.county,
        country: "United States",
        longitude: +iterator.longitude,
        latitude: +iterator.latitude,
        unitType: iterator.reported_mailing_std_unit_type,
        unitNum: iterator.reported_mailing_std_unit_nbr + "",
      };
      res = await addressTable.create(
        filterEmptyKeys(propertyHoldingCompanyAddress)
      );
      const propertyHoldingCompanyAddressId = res.getId();

      const contactsFromSheet = result.contacts.filter(
        (item) => item.reonomy_property_id === iterator.reonomy_id
      );
      const contactItems = [];

      for (const contactData of contactsFromSheet) {
        const highestPhoneNumber = Object.keys(contactData || {}).map((key) => {
          const match = key.match(/contact_phone_(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
        const iteration = Math.max(
          ...(highestPhoneNumber.length ? highestPhoneNumber : [3])
        );
        const emailItems = [];
        const phoneItems = [];
        const addressItems = [];

        for (let j = 1; j <= iteration; j++) {
          try {
            const phone = {
              phoneNumber:
                contactData[convertToDynamicName("contact", "phone", j)] + "",
              type: contactData[
                `${convertToDynamicName("contact", "phone", j)}_type`
              ],
            };

            if (!areAllKeysUndefinedOrEmpty(phone)) {
              phoneItems.push({ fields: filterEmptyKeys(phone) });
            }

            const email = {
              email: contactData[convertToDynamicName("contact", "email", j)],
              type: "",
            };
            if (!areAllKeysUndefinedOrEmpty(email)) {
              emailItems.push({ fields: filterEmptyKeys(email) });
            }

            const contactAddress = {
              street:
                contactData[
                  convertToDynamicName("contact", "address", j) + `_line_1`
                ],
              city: contactData[
                convertToDynamicName("contact", "address", j) + `_city`
              ],
              state:
                contactData[
                  convertToDynamicName("contact", "address", j) + `_state`
                ],
              zip:
                contactData[
                  convertToDynamicName("contact", "address", j) + `_postal_code`
                ] + "",
            };

            if (!areAllKeysUndefinedOrEmpty(contactAddress)) {
              addressItems.push({ fields: filterEmptyKeys(contactAddress) });
            }
          } catch (error) {
            console.error(error);
            continue;
          }
        }

        const phones = await batchCreate(phoneTable, phoneItems);
        const emails = await batchCreate(emailTable, emailItems);
        const addresses = await batchCreate(addressTable, addressItems);

        const firstName = contactData.contact_name?.split(" ");
        const contact = {
          firstName: firstName?.[0],
          lastName: firstName?.slice(1).join(" "),
          address: addresses.map((addr) => addr.id),
          position: contactData.contact_title,
          companyImport: contactData.contact_company_name,
          phone: phones.map((phone) => phone.id),
          contactDataSourceLink: contactData.contact_portfolio_link,
        };
        if (!areAllKeysUndefinedOrEmpty(contact)) {
          contactItems.push({ fields: filterEmptyKeys(contact) });
        }
      }

      const contacts = await batchCreate(contactTable, contactItems);

      const propertyHoldingCompany = {
        propertyHoldingCompanyName: iterator.reported_owner_name,
        contact: contacts.map((contact) => contact.id),
        address: [propertyHoldingCompanyAddressId],
      };
      res = await propertyHoldingCompanyTable.create(
        filterEmptyKeys(propertyHoldingCompany)
      );
      const propertyHoldingCompanyId = res.getId();

      const property = {
        address: [propertyAddressId],
        dataSource: "Reonomy",
        dataSourceUrl: iterator.link,
        dataSourceID: iterator.reonomy_id,
        apnCode: iterator.apn,
        fipsCode: iterator.fips_code + "",
        censusTrack: iterator.census_tract + "",
        grossBuildingArea: +iterator.gross_building_area,
        totalUnits: +iterator.total_units,
        totalResidentialUnits: +iterator.total_residential_units,
        totalCommercialUnits: +iterator.total_commercial_units,
        propertyType: iterator.property_type,
        propertySubType: iterator.property_subtype,
        yearBuilt: +iterator.year_built,
        yearRenovated: +iterator.year_renovated,
        stories: +iterator.stories,
        zoning: iterator.zoning,
        taxYear: +iterator.tax_year,
        taxTotalMarketValue: removeSpecialCharsAndConvertToNumber(
          iterator.tax_total_market_value
        ),
        taxLandMarketValue: removeSpecialCharsAndConvertToNumber(
          iterator.tax_land_market_value
        ),
        taxImprovementMarketValue: removeSpecialCharsAndConvertToNumber(
          iterator.tax_improvement_market_value
        ),
        assdImprovementValue: removeSpecialCharsAndConvertToNumber(
          iterator.assd
        ),
        assdLandValue: removeSpecialCharsAndConvertToNumber(
          iterator.assd_land_value
        ),
        assdTotalValue: removeSpecialCharsAndConvertToNumber(
          iterator.assd_total_value
        ),
        taxAmount: removeSpecialCharsAndConvertToNumber(iterator.tax_amount),
        taxChange: removeSpecialCharsAndConvertToNumber(iterator.tax_change),
        taxChangePct: removeSpecialCharsAndConvertToNumber(
          iterator.tax_change_pct
        ),
        taxRate: removeSpecialCharsAndConvertToNumber(iterator.tax_rate),
        propertyHoldingCompany: [propertyHoldingCompanyId],
      };
      res = await propertyTable.create(filterEmptyKeys(property));
      row.property = res.getId();

      rows.push(row);
    } catch (error) {
      console.error(error);
      continue;
    }
  }
  return rows;
}
