import { DefaultSession } from "next-auth"

type RoleScopeType = "GLOBAL" | "REGIONAL"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: string
            roleScopeType?: RoleScopeType
            regionId?: string | null
            regionalOfficeId?: string | null
            regionName?: string | null
            regionalOfficeName?: string | null
            permissions?: string[]
        } & DefaultSession["user"]
    }

    interface User {
        role: string
        roleScopeType?: RoleScopeType
        regionId?: string | null
        regionalOfficeId?: string | null
        regionName?: string | null
        regionalOfficeName?: string | null
        permissions?: string[]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: string
        roleScopeType?: "GLOBAL" | "REGIONAL"
        regionId?: string | null
        regionalOfficeId?: string | null
        regionName?: string | null
        regionalOfficeName?: string | null
        permissions?: string[]
    }
}
