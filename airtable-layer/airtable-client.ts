import Airtable from 'airtable';

class AirtableClient {
    private base: Airtable.Base;

    constructor(apiKey: string, baseId: string) {
        Airtable.configure({
            apiKey: apiKey
        });
        this.base = Airtable.base(baseId);
    }

    // Method to get records from a table
    public async getRecords(tableName: string, maxRecords: number = 100): Promise<any[]> {
        const records: any[] = [];
        try {
            const query = this.base(tableName).select({ maxRecords });
            await query.eachPage((pageRecords, fetchNextPage) => {
                records.push(...pageRecords);
                fetchNextPage();
            });
            return records;
        } catch (error) {
            console.error('Error fetching records:', error);
            throw error;
        }
    }

    // Method to create a record
    public async createRecord(tableName: string, fields: any): Promise<any> {
        try {
            const record = await this.base(tableName).create(fields);
            return record;
        } catch (error) {
            console.error('Error creating record:', error);
            throw error;
        }
    }

    // Method to update a record
    public async updateRecord(tableName: string, recordId: string, fields: any): Promise<any> {
        try {
            const record = await this.base(tableName).update(recordId, fields);
            return record;
        } catch (error) {
            console.error('Error updating record:', error);
            throw error;
        }
    }

    // Method to delete a record
    public async deleteRecord(tableName: string, recordId: string): Promise<void> {
        try {
            await this.base(tableName).destroy(recordId);
        } catch (error) {
            console.error('Error deleting record:', error);
            throw error;
        }
    }
}

export default AirtableClient;
