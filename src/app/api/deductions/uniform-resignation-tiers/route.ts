import { buildListAndCreateHandlers } from "@/lib/deductions/routeFactory"

const handlers = buildListAndCreateHandlers("UniformResignationTier")
export const GET = handlers.GET
export const POST = handlers.POST
