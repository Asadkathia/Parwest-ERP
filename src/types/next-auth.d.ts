import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: string
            regionId?: string | null
            regionalOfficeId?: string | null
        } & DefaultSession["user"]
    }

    interface User {
        role: string
        regionId?: string | null
        regionalOfficeId?: string | null
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: string
        regionId?: string | null
        regionalOfficeId?: string | null
    }
}
