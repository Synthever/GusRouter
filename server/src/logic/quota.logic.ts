import { getQuotaSummaryDB } from "@srouter/db";
import type { QuotaResponse } from "@srouter/types";

export class QuotaLogic {
    public static async getQuotaInfo(): Promise<QuotaResponse> {
        return await getQuotaSummaryDB();
    }
}
