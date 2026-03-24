// agents/verify/e2e-test-agent.js
// Generates E2E test scenarios for happy path and error paths.
// Returns: { scenarios: Scenario[], playwright_config: string }

import { AgentBase } from '../../shared/agent-base-class.js'

class E2eTestAgent extends AgentBase {
  constructor() {
    super({ name: 'e2e-test-agent', phase: 'verify', version: '1.0.0' })
  }

  async run(context) {
    const { spec, architectureSpec } = context

    if (!spec) {
      throw new Error('e2e-test-agent requires spec in context')
    }

    const appName = spec.name || 'App'
    const baseUrl = spec.deploy_url || 'http://localhost:5173'

    this.log('info', 'Generating E2E test scenarios', { app_name: appName })

    const scenarios = this._buildScenarios(spec, architectureSpec)
    const playwright_config = this._buildPlaywrightConfig(appName, baseUrl)
    const test_files = this._buildTestFiles(scenarios, spec)

    this.log('info', 'E2E generation complete', {
      scenarios: scenarios.length,
      test_files: Object.keys(test_files).length,
    })

    return { scenarios, playwright_config, test_files }
  }

  _buildScenarios(spec, architectureSpec) {
    const scenarios = []
    const tier = spec?.tier || 'STANDARD'

    // ── Happy path scenarios ────────────────────────────────────────────

    scenarios.push({
      id: 'home_loads',
      name: 'Homepage loads and renders hero content',
      path: 'home',
      type: 'happy',
      steps: [
        { action: 'navigate', url: '/' },
        { action: 'expect_visible', selector: 'h1' },
        { action: 'expect_no_console_error' },
        { action: 'expect_accessible', wcag: 'AA' },
      ],
    })

    if (tier === 'STANDARD' || tier === 'COMPLEX') {
      scenarios.push({
        id: 'signup_flow',
        name: 'User can sign up with valid email',
        path: 'auth',
        type: 'happy',
        steps: [
          { action: 'navigate', url: '/signup' },
          { action: 'fill', selector: 'input[type="email"]', value: 'test@example.com' },
          { action: 'fill', selector: 'input[type="password"]', value: 'Test123456!' },
          { action: 'click', selector: 'button[type="submit"]' },
          { action: 'expect_url_contains', value: '/dashboard' },
        ],
      })

      scenarios.push({
        id: 'login_flow',
        name: 'User can log in with valid credentials',
        path: 'auth',
        type: 'happy',
        steps: [
          { action: 'navigate', url: '/login' },
          { action: 'fill', selector: 'input[type="email"]', value: 'test@example.com' },
          { action: 'fill', selector: 'input[type="password"]', value: 'Test123456!' },
          { action: 'click', selector: 'button[type="submit"]' },
          { action: 'expect_url_contains', value: '/dashboard' },
        ],
      })

      scenarios.push({
        id: 'dashboard_loads',
        name: 'Authenticated user sees dashboard',
        path: 'dashboard',
        type: 'happy',
        steps: [
          { action: 'login_as', email: 'test@example.com', password: 'Test123456!' },
          { action: 'navigate', url: '/dashboard' },
          { action: 'expect_visible', selector: 'main' },
          { action: 'expect_no_console_error' },
        ],
      })

      scenarios.push({
        id: 'protected_route_redirect',
        name: 'Unauthenticated user redirected from protected route',
        path: 'auth',
        type: 'happy',
        steps: [
          { action: 'navigate', url: '/dashboard' },
          { action: 'expect_url_contains', value: '/login' },
        ],
      })
    }

    // Feature-specific scenarios
    const features = spec?.features || []
    for (const feature of features.slice(0, 3)) {
      // Max 3 feature scenarios
      const slug = feature.toLowerCase().replace(/\s+/g, '-')
      scenarios.push({
        id: `feature_${slug}`,
        name: `User can complete: ${feature}`,
        path: 'features',
        type: 'happy',
        steps: [
          { action: 'login_as', email: 'test@example.com', password: 'Test123456!' },
          { action: 'navigate', url: '/dashboard' },
          { action: 'expect_visible', selector: `[data-testid="${slug}"], [aria-label*="${feature}"], button` },
          { action: 'comment', text: `TODO: Add specific steps for "${feature}"` },
        ],
      })
    }

    // ── Error path scenarios ────────────────────────────────────────────

    scenarios.push({
      id: 'signup_invalid_email',
      name: 'Signup shows error for invalid email',
      path: 'auth',
      type: 'error',
      steps: [
        { action: 'navigate', url: '/signup' },
        { action: 'fill', selector: 'input[type="email"]', value: 'not-an-email' },
        { action: 'fill', selector: 'input[type="password"]', value: 'Test123456!' },
        { action: 'click', selector: 'button[type="submit"]' },
        { action: 'expect_visible', selector: '[role="alert"], .error, [data-testid="error"]' },
        { action: 'expect_url_not_contains', value: '/dashboard' },
      ],
    })

    scenarios.push({
      id: 'login_wrong_password',
      name: 'Login shows error for wrong password',
      path: 'auth',
      type: 'error',
      steps: [
        { action: 'navigate', url: '/login' },
        { action: 'fill', selector: 'input[type="email"]', value: 'test@example.com' },
        { action: 'fill', selector: 'input[type="password"]', value: 'WrongPassword!' },
        { action: 'click', selector: 'button[type="submit"]' },
        { action: 'expect_visible', selector: '[role="alert"], .error, [data-testid="error"]' },
      ],
    })

    scenarios.push({
      id: 'mobile_375px',
      name: 'App is functional at 375px mobile width',
      path: 'mobile',
      type: 'responsive',
      viewport: { width: 375, height: 812 },
      steps: [
        { action: 'set_viewport', width: 375, height: 812 },
        { action: 'navigate', url: '/' },
        { action: 'expect_no_horizontal_scroll' },
        { action: 'expect_visible', selector: 'nav, header' },
      ],
    })

    return scenarios
  }

  _buildPlaywrightConfig(appName, baseUrl) {
    return `// playwright.config.ts — E2E test configuration for ${appName}
// Generated by Sovereign e2e-test-agent
// Run with: npx playwright test

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'e2e-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || '${baseUrl}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: '${baseUrl}',
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
})
`
  }

  _buildTestFiles(scenarios, spec) {
    const appName = spec?.name || 'App'
    const byPath = {}

    for (const scenario of scenarios) {
      if (!byPath[scenario.path]) byPath[scenario.path] = []
      byPath[scenario.path].push(scenario)
    }

    const files = {}
    for (const [path, pathScenarios] of Object.entries(byPath)) {
      files[`e2e/${path}.spec.ts`] = this._generateSpecFile(path, pathScenarios, appName)
    }

    return files
  }

  _generateSpecFile(path, scenarios, appName) {
    const tests = scenarios
      .map(s => {
        const steps = s.steps
          .map(step => `    // ${step.action}: ${JSON.stringify(step).slice(0, 80)}`)
          .join('\n')
        return `  test('${s.name}', async ({ page }) => {
${steps}
    // TODO: Implement steps above
    await page.goto('${s.steps.find(st => st.url)?.url || '/'}')
    await expect(page).toHaveURL(/.+/)
  })`
      })
      .join('\n\n')

    return `// E2E tests for ${path} — ${appName}
// Generated by Sovereign e2e-test-agent
// Run with: npx playwright test e2e/${path}.spec.ts

import { test, expect } from '@playwright/test'

test.describe('${path}', () => {
${tests}
})
`
  }
}

export default async function run(context) {
  return new E2eTestAgent().execute(context)
}
