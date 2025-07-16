import { NextResponse } from "next/server"

export async function GET() {
  try {
    // システム情報を収集
    const systemInfo = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    }

    // Next.js情報
    const nextjsInfo = {
      version: process.env.npm_package_dependencies_next || "不明",
      reactVersion: process.env.npm_package_dependencies_react || "不明",
      nodeEnv: process.env.NODE_ENV,
    }

    // Vercel環境情報
    const vercelInfo = {
      isVercel: !!process.env.VERCEL,
      environment: process.env.VERCEL_ENV,
      region: process.env.VERCEL_REGION,
      url: process.env.VERCEL_URL,
      branchUrl: process.env.VERCEL_BRANCH_URL,
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7),
    }

    return NextResponse.json({
      success: true,
      deployment: systemInfo,
      nextjs: nextjsInfo,
      vercel: vercelInfo,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
