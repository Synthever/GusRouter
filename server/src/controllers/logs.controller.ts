import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { LogsLogic } from "@/logic/logs.logic.js";
import { Ok } from "@/utils/response.js";
import { AnalyticsQuerySchema } from "@srouter/types";

export class LogsController {
    public static ListLogs(c: Context): Response {
        const limit = Number(c.req.query("limit")) || 50;
        return Ok(c, {
            object: "list",
            data: LogsLogic.getRecentLogs(limit)
        });
    }

    public static GetStats(c: Context): Response {
        return Ok(c, LogsLogic.getUsageStats());
    }

    public static GetAnalytics(c: Context): Response {
        const Query = c.req.query("window") || "24h";
        const Result = AnalyticsQuerySchema.safeParse({ window: Query });
        if (!Result.success) {
            throw new HTTPException(400, { message: "Invalid window parameter" });
        }
        return Ok(c, LogsLogic.getAnalytics(Result.data.window));
    }

    public static GetUsagePeriodStats(c: Context): Response {
        const period = c.req.query("period") || "today";
        return Ok(c, LogsLogic.getUsagePeriodStats(period));
    }

    public static GetRequestDetails(c: Context): Response {
        const page = Number(c.req.query("page")) || 1;
        const pageSize = Number(c.req.query("pageSize")) || 20;
        const provider = c.req.query("provider");
        const model = c.req.query("model");
        const apiKeyId = c.req.query("apiKeyId");
        const status = c.req.query("status");
        const startDate = c.req.query("startDate");
        const endDate = c.req.query("endDate");

        return Ok(
            c,
            LogsLogic.getRequestDetails({
                page,
                pageSize,
                provider,
                model,
                apiKeyId,
                status,
                startDate,
                endDate
            })
        );
    }
}
