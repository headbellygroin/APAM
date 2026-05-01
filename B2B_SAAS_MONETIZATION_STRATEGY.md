# B2B SaaS Monetization Strategy
## Enterprise Educational Trading Platform

---

## Table of Contents
1. [Multi-Tenant Architecture](#1-multi-tenant-architecture)
2. [Pricing Models](#2-pricing-models)
3. [Subscription Control](#3-subscription-controlaccess-management)
4. [Network Installation Options](#4-network-installation-options)
5. [Subscription Enforcement Architecture](#5-subscription-enforcement-architecture)
6. [Billing Integration](#6-billing-integration)
7. [Complete B2B Sales Flow](#7-complete-b2b-sales-flow)
8. [Admin Portal Requirements](#8-admin-portal-requirements)
9. [Legal & Corporate Structure](#9-legalcorporate-structure)
10. [Revenue Model Projections](#10-revenue-model-example)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. Multi-Tenant Architecture

### Conceptual Model

```
Your Platform (Single Codebase)
│
├─ Institution A (Stanford University)
│  ├─ 500 student seats
│  ├─ 10 professor/admin seats
│  ├─ Isolated database schema
│  ├─ Custom branding (optional)
│  └─ Their own isolated AI learning environment
│
├─ Institution B (UCLA Economics Dept)
│  ├─ 200 student seats
│  ├─ 5 professor seats
│  └─ Separate data/AI
│
└─ Institution C (Harvard Business School)
   ├─ 1000 seats
   └─ Premium features
```

### Database Schema Design

```sql
-- Organizations (Schools/Universities)
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text UNIQUE, -- "stanford.edu"
  plan_type text NOT NULL, -- 'basic', 'premium', 'enterprise'
  max_seats integer NOT NULL,
  billing_cycle text NOT NULL, -- 'monthly', 'annual', 'perpetual'
  price_per_seat numeric,
  contract_start date,
  contract_end date,
  status text NOT NULL DEFAULT 'trial', -- 'active', 'suspended', 'trial', 'cancelled'
  features jsonb DEFAULT '[]'::jsonb, -- Custom feature flags
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Organization Users (Students/Professors)
CREATE TABLE organization_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'student', 'professor', 'admin'
  seat_number integer,
  enrolled_at timestamptz DEFAULT now(),
  last_active timestamptz,
  UNIQUE(organization_id, user_id)
);

-- Billing/Subscriptions
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  plan_type text NOT NULL,
  seats_purchased integer NOT NULL,
  amount_per_period numeric NOT NULL,
  billing_period text NOT NULL, -- 'monthly', 'annual'
  next_billing_date date,
  status text NOT NULL DEFAULT 'pending', -- 'active', 'past_due', 'cancelled', 'pending'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Usage Tracking (for metered billing)
CREATE TABLE usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  month date NOT NULL,
  active_users integer DEFAULT 0,
  total_trades_simulated bigint DEFAULT 0,
  ai_training_hours numeric DEFAULT 0,
  api_calls bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, month)
);

-- Organization Admins
CREATE TABLE organization_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'admin', 'billing', 'professor'
  permissions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);
```

### Row Level Security (RLS) Policies

```sql
-- Organizations: Admins can view their organization
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM organization_admins
      WHERE user_id = auth.uid()
    )
  );

-- Organization Users: Admins can manage their org's users
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org membership"
  ON organization_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view org users"
  ON organization_users FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_admins
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert org users"
  ON organization_users FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_admins
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins can delete org users"
  ON organization_users FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_admins
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Subscriptions: Admins can view their org's subscription
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view org subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_admins
      WHERE user_id = auth.uid()
    )
  );

-- Usage Metrics: Admins can view their org's metrics
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view org metrics"
  ON usage_metrics FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_admins
      WHERE user_id = auth.uid()
    )
  );

-- Organization Admins
ALTER TABLE organization_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own admin record"
  ON organization_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

---

## 2. Pricing Models

### Option A: Seat-Based Licensing (RECOMMENDED)
**Most Common: Tradier, Bloomberg Terminal, Adobe Enterprise**

```
Pricing Tiers:

├─ Basic: $15/seat/month
│  └─ Features:
│     ├─ Paper trading
│     ├─ Personal AI trainer
│     ├─ 2 training accounts
│     ├─ Basic strategies (APAM, Fibonacci OR)
│     └─ Standard support
│
├─ Professional: $30/seat/month
│  └─ Features:
│     ├─ All Basic features
│     ├─ 10 training accounts
│     ├─ All strategies
│     ├─ Historical data access
│     ├─ Advanced analytics
│     └─ Priority support
│
└─ Enterprise: Custom pricing
   └─ Features:
      ├─ All Professional features
      ├─ Unlimited training accounts
      ├─ Custom integrations
      ├─ Dedicated support
      ├─ On-premise deployment option
      ├─ Custom branding
      └─ SLA guarantees
```

**Annual Contract Example:**
```
Stanford University:
├─ 500 seats @ $25/seat/month (Professional tier)
├─ Annual contract: 500 × $25 × 12 = $150,000/year
├─ Payment: Upfront or quarterly
├─ Discount: 10% for annual vs monthly billing
└─ Renewal: Auto-renew with 90-day notice period
```

---

### Option B: Flat-Fee Site License
**Example: Matlab for Universities, SAS Analytics**

```
Pricing by Institution Size:

├─ Small Institution (<500 students): $50,000/year
│  └─ Unlimited access within student body
│
├─ Medium Institution (500-2000): $120,000/year
│  └─ Includes faculty training
│
└─ Large Institution (2000+): $250,000/year
   └─ Includes custom onboarding

What's Included:
├─ Unlimited student access
├─ Installation on campus network
├─ Faculty training (2 sessions)
├─ Annual updates
├─ Standard support
└─ Usage analytics
```

---

### Option C: Hybrid Metered + Base
**Example: AWS, Snowflake**

```
Structure:

Base Fee: $2,000/month
+
Usage Charges:
├─ $0.10 per AI training hour
├─ $0.05 per 1,000 API calls
├─ $50/month per additional training account beyond 10
└─ $5 per student per month (active users only)

Monthly Invoice:
├─ Base: $2,000
├─ 500 AI training hours: $50
├─ 1M API calls: $50
├─ 150 active students: $750
└─ Total: $2,850
```

---

### Option D: Perpetual License
**Example: On-premise software like AutoCAD network licenses**

```
One-Time Purchase:

├─ License Fee: $200,000 for 500 seats
│  └─ School owns it forever
│
├─ Optional Annual Maintenance: $30,000/year (15% of license)
│  └─ Includes:
│     ├─ Software updates
│     ├─ Technical support
│     └─ New features
│
└─ Runs on school's servers
   ├─ No recurring subscription
   └─ No internet required (after initial activation)
```

---

### RECOMMENDED APPROACH

**Dual Model Strategy:**

**Primary: Seat-Based SaaS (Option A)**
- Lower barrier to entry
- Predictable recurring revenue
- Easy to scale up/down
- Standard for educational software

**Alternative: Perpetual License (Option D)**
- For schools with budget constraints
- One-time capital expense
- Appeals to IT departments wanting control
- Higher upfront revenue

**Educational Pricing:**
- Price at 40-60% of commercial rates
- Commercial rate: $50/seat/month
- Educational rate: $20-30/seat/month
- Justification: "Educational discount" + volume

---

## 3. Subscription Control/Access Management

### Method 1: License Keys (Legacy/On-Premise)

```
License Key Generation:

When Stanford purchases 500 seats for 1 year:

Generated Key: STAN-500-2027-XJ7K9

Key Encoding:
├─ STAN = Organization short code
├─ 500 = Maximum seats
├─ 2027 = Expiration year
└─ XJ7K9 = Validation hash

On Every Login:
1. System validates key format
2. Checks expiration date
3. Counts active users vs seat limit
4. Allows/denies access

Advantages:
├─ Works offline
├─ Simple implementation
└─ No external dependencies

Disadvantages:
├─ Can be shared/pirated
├─ Manual management
└─ No real-time control
```

---

### Method 2: Cloud-Based Validation (RECOMMENDED)

```sql
-- Login Validation Query

SELECT
  o.id,
  o.name,
  o.status,
  o.max_seats,
  o.features,
  COUNT(ou.user_id) as seats_used,
  s.status as subscription_status,
  s.next_billing_date
FROM organizations o
LEFT JOIN organization_users ou ON ou.organization_id = o.id
LEFT JOIN subscriptions s ON s.organization_id = o.id
WHERE o.id = $organization_id
  AND o.status = 'active'
  AND s.status = 'active'
  AND s.next_billing_date > NOW()
GROUP BY o.id, s.id;

-- Decision Logic:
-- If query returns no rows → Access denied
-- If seats_used >= max_seats → No new users
-- If subscription_status != 'active' → Access denied
-- If next_billing_date < NOW() → Access denied (grace period: 7 days)
```

**Implementation Pattern:**

```typescript
// src/lib/subscriptionGate.ts

export interface AccessCheck {
  allowed: boolean;
  reason?: string;
  features: string[];
  organizationName?: string;
  seatsUsed?: number;
  seatsTotal?: number;
}

export class SubscriptionGate {
  async checkAccess(userId: string): Promise<AccessCheck> {
    // 1. Get user's organization
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select(`
        organization_id,
        role,
        organizations (
          id,
          name,
          status,
          max_seats,
          features,
          plan_type
        )
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (!orgUser) {
      return {
        allowed: false,
        reason: 'No organization membership found',
        features: []
      };
    }

    const org = orgUser.organizations;

    // 2. Check organization status
    if (org.status !== 'active') {
      return {
        allowed: false,
        reason: `Organization status: ${org.status}`,
        features: []
      };
    }

    // 3. Get subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, next_billing_date')
      .eq('organization_id', org.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!subscription) {
      return {
        allowed: false,
        reason: 'No active subscription found',
        features: []
      };
    }

    // 4. Check billing date (with 7-day grace period)
    const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
    const billingDate = new Date(subscription.next_billing_date);
    const now = new Date();

    if (billingDate < now && (now.getTime() - billingDate.getTime()) > gracePeriod) {
      return {
        allowed: false,
        reason: 'Subscription payment overdue',
        features: []
      };
    }

    // 5. Check seat limit
    const { count } = await supabase
      .from('organization_users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    if (count && count > org.max_seats) {
      return {
        allowed: false,
        reason: 'Seat limit exceeded',
        features: []
      };
    }

    // 6. Update last active timestamp
    await supabase
      .from('organization_users')
      .update({ last_active: new Date().toISOString() })
      .eq('user_id', userId);

    // 7. Return access granted
    return {
      allowed: true,
      features: org.features || [],
      organizationName: org.name,
      seatsUsed: count || 0,
      seatsTotal: org.max_seats
    };
  }

  async canAccessFeature(userId: string, feature: string): Promise<boolean> {
    const access = await this.checkAccess(userId);
    return access.allowed && access.features.includes(feature);
  }
}
```

**Usage in Application:**

```typescript
// In App.tsx or protected route

import { SubscriptionGate } from './lib/subscriptionGate';

function App() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const gate = new SubscriptionGate();
      gate.checkAccess(user.id).then(result => {
        setAccess(result);
        setLoading(false);
      });
    }
  }, [user]);

  if (loading) return <LoadingScreen />;

  if (!access?.allowed) {
    return (
      <SubscriptionExpiredScreen
        reason={access?.reason}
        organizationName={access?.organizationName}
      />
    );
  }

  return <MainApp features={access.features} />;
}
```

---

### Method 3: SSO Integration (Enterprise)

```
Single Sign-On Flow:

1. Student navigates to yourapp.com
2. Clicks "Login with Stanford"
3. Redirected to Stanford's SSO (Shibboleth/SAML/OAuth)
4. Stanford authenticates student
5. Stanford sends back to your app with:
   ├─ Email: student@stanford.edu
   ├─ Organization: stanford.edu
   ├─ Student ID: 123456
   └─ Attributes: { role: 'student', department: 'economics' }
6. Your app:
   ├─ Extracts domain: stanford.edu
   ├─ Looks up organization by domain
   ├─ Checks subscription status
   ├─ Creates/updates user account
   └─ Grants access

Advantages:
├─ No password management
├─ Students use existing credentials
├─ Automatic user provisioning
├─ Meets IT security requirements
└─ Auto-deprovisioning (when student leaves)

Implementation:
├─ Use SAML 2.0 or OAuth 2.0
├─ Libraries: passport-saml, Auth0, Okta
└─ Each school requires custom SSO setup
```

---

## 4. Network Installation Options

### Option A: Cloud SaaS (RECOMMENDED)

```
Architecture:

Your Infrastructure:
├─ Hosted App: Vercel/Netlify/AWS
├─ Database: Supabase (multi-tenant)
├─ Edge Functions: Supabase Edge
└─ CDN: Global distribution

School Access Options:
├─ Subdomain: stanford.yourapp.com
├─ Path: yourapp.com/stanford
└─ Custom domain: trading.stanford.edu → CNAME to yourapp.com

School Requirements:
└─ Internet connection only
   ├─ No installation needed
   ├─ Works on any device
   └─ Chromebook compatible

You Control:
├─ All updates/maintenance
├─ Instant feature deployment
├─ Centralized monitoring
└─ All data (encrypted, backed up)

Pricing Impact:
├─ Lower cost for schools (no infrastructure)
├─ Higher margins for you
└─ Easier support

Data Isolation:
├─ Database level: organization_id on all tables
├─ RLS policies enforce tenant boundaries
└─ Each org sees only their data
```

**Pros:**
- Easiest to maintain
- Instant updates for all schools
- Lower cost structure
- No installation support burden
- Cross-platform compatibility

**Cons:**
- Requires internet connection
- Schools don't control data location
- Some institutions require on-premise

---

### Option B: On-Premise Installation (Enterprise)

```
Deployment Model:

You Provide:
├─ Docker container image
├─ OR VM image (VirtualBox/VMware)
├─ OR Kubernetes helm chart
└─ Installation documentation

School's Infrastructure:
├─ Server: Linux VM on campus network
├─ Database: PostgreSQL (bundled or separate)
├─ Storage: Local disk
└─ Network: Campus intranet only

Installation Process:
1. School IT downloads installation package
2. Run setup script:
   docker run -e LICENSE_KEY=STAN-500-2027-XJ7K9 \
              -p 80:80 yourapp:latest
3. Access via campus network: http://trading.local
4. License activation:
   ├─ Online: Validates with your server
   └─ Offline: Manual activation code

License Enforcement:
├─ Daily "phone home" to license server
├─ If unreachable for 30 days → grace period warning
├─ After 60 days → soft lock (read-only mode)
└─ Manual renewal process

You Provide:
├─ Installation package
├─ Installation support (billable hours or included)
├─ Annual updates (via maintenance contract)
└─ Remote troubleshooting access (VPN/SSH)

Pricing Impact:
├─ Higher upfront cost ($200k vs $150k)
├─ Maintenance contract: $30k/year (optional)
└─ Installation service: $5k-10k
```

**Pros:**
- School controls data location
- Works without internet (after activation)
- Meets strict IT security requirements
- Faster performance (local network)

**Cons:**
- Complex deployment
- Version fragmentation (different schools on different versions)
- Higher support burden
- Manual updates
- Requires school IT resources

---

### Option C: Hybrid (Private Cloud)

```
Best of Both Worlds:

Default: Multi-tenant SaaS

Premium Add-On: Dedicated Instance
├─ School gets their own:
│  ├─ Dedicated server cluster
│  ├─ Dedicated database
│  ├─ Isolated network
│  └─ Custom subdomain: trading.stanford.edu
├─ Still managed by you (not school IT)
├─ Data resides in specified region
└─ Extra cost: $50k/year

Implementation:
├─ AWS: Separate VPC per org
├─ Supabase: Dedicated project
└─ Deployment: Automated (Terraform/CDK)

Who It's For:
├─ Large institutions (1000+ seats)
├─ Regulatory requirements (data residency)
└─ Performance requirements (low latency)
```

---

## 5. Subscription Enforcement Architecture

### Application Startup Checks

```typescript
// src/lib/subscriptionEnforcement.ts

export class SubscriptionEnforcement {
  private static instance: SubscriptionEnforcement;
  private cache = new Map<string, { access: AccessCheck; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): SubscriptionEnforcement {
    if (!this.instance) {
      this.instance = new SubscriptionEnforcement();
    }
    return this.instance;
  }

  async enforceAccess(userId: string): Promise<AccessCheck> {
    // Check cache first
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.access;
    }

    // Perform fresh check
    const gate = new SubscriptionGate();
    const access = await gate.checkAccess(userId);

    // Cache result
    this.cache.set(userId, { access, timestamp: Date.now() });

    // Log access attempt
    await this.logAccessAttempt(userId, access);

    return access;
  }

  private async logAccessAttempt(userId: string, access: AccessCheck) {
    await supabase.from('access_logs').insert({
      user_id: userId,
      allowed: access.allowed,
      reason: access.reason,
      timestamp: new Date().toISOString()
    });
  }

  clearCache(userId?: string) {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }
}
```

---

### Feature Flags System

```typescript
// src/lib/featureFlags.ts

export const FEATURE_FLAGS = {
  UNLIMITED_TRAINING_ACCOUNTS: 'unlimited_training_accounts',
  ADVANCED_STRATEGIES: 'advanced_strategies',
  HISTORICAL_DATA: 'historical_data',
  REAL_TIME_DATA: 'real_time_data',
  CUSTOM_BRANDING: 'custom_branding',
  API_ACCESS: 'api_access',
  EXPORT_DATA: 'export_data',
  PRIORITY_SUPPORT: 'priority_support'
} as const;

export class FeatureGate {
  constructor(private features: string[]) {}

  has(feature: string): boolean {
    return this.features.includes(feature);
  }

  getTrainingAccountLimit(): number {
    if (this.has(FEATURE_FLAGS.UNLIMITED_TRAINING_ACCOUNTS)) {
      return Infinity;
    }
    if (this.has(FEATURE_FLAGS.ADVANCED_STRATEGIES)) {
      return 10;
    }
    return 2; // Basic tier
  }

  getAvailableStrategies(): string[] {
    if (this.has(FEATURE_FLAGS.ADVANCED_STRATEGIES)) {
      return ['apam', 'fibonacci_or', 'trade_surge', 'custom'];
    }
    return ['apam', 'fibonacci_or']; // Basic strategies only
  }

  canAccessHistoricalData(): boolean {
    return this.has(FEATURE_FLAGS.HISTORICAL_DATA);
  }
}

// Usage in components:
const { access } = useSubscription();
const featureGate = new FeatureGate(access.features);

if (featureGate.has(FEATURE_FLAGS.ADVANCED_STRATEGIES)) {
  // Show advanced strategies
}
```

---

### Background Subscription Monitor

```typescript
// supabase/functions/subscription-monitor/index.ts
// Runs daily via cron job

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find subscriptions expiring in 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data: expiringSubscriptions } = await supabaseClient
      .from('subscriptions')
      .select(`
        *,
        organizations (name, id)
      `)
      .eq('status', 'active')
      .lte('next_billing_date', sevenDaysFromNow.toISOString())
      .gte('next_billing_date', new Date().toISOString());

    // Send reminder emails
    for (const sub of expiringSubscriptions || []) {
      await sendRenewalReminder(sub);
    }

    // Find overdue subscriptions (past grace period)
    const { data: overdueSubscriptions } = await supabaseClient
      .from('subscriptions')
      .select('*, organizations (id, name)')
      .eq('status', 'active')
      .lt('next_billing_date', new Date().toISOString());

    // Suspend organizations
    for (const sub of overdueSubscriptions || []) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(sub.next_billing_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysOverdue > 7) {
        // Suspend
        await supabaseClient
          .from('organizations')
          .update({ status: 'suspended' })
          .eq('id', sub.organizations.id);

        await sendSuspensionNotice(sub);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        expiring: expiringSubscriptions?.length || 0,
        suspended: overdueSubscriptions?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 6. Billing Integration

### Stripe Billing (RECOMMENDED for SaaS)

```typescript
// src/lib/stripeBilling.ts

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export class StripeBillingService {
  // Create organization and subscription
  async createOrganization(data: {
    name: string;
    email: string;
    domain: string;
    seats: number;
    planType: 'basic' | 'professional' | 'enterprise';
    billingCycle: 'monthly' | 'annual';
  }) {
    // 1. Create Stripe customer
    const customer = await stripe.customers.create({
      name: data.name,
      email: data.email,
      metadata: {
        domain: data.domain,
        plan_type: data.planType
      }
    });

    // 2. Create organization in Supabase
    const { data: org } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        domain: data.domain,
        plan_type: data.planType,
        max_seats: data.seats,
        billing_cycle: data.billingCycle,
        status: 'trial' // Start with trial
      })
      .select()
      .single();

    // 3. Get pricing
    const pricePerSeat = this.getPricing(data.planType, data.billingCycle);
    const totalAmount = pricePerSeat * data.seats;

    // 4. Create Stripe subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${data.planType} Plan - ${data.seats} seats`,
              metadata: {
                organization_id: org.id,
                plan_type: data.planType
              }
            },
            recurring: {
              interval: data.billingCycle === 'annual' ? 'year' : 'month'
            },
            unit_amount: Math.round(totalAmount * 100) // Convert to cents
          },
          quantity: 1
        }
      ],
      trial_period_days: 30,
      metadata: {
        organization_id: org.id
      }
    });

    // 5. Save subscription to Supabase
    await supabase.from('subscriptions').insert({
      organization_id: org.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customer.id,
      plan_type: data.planType,
      seats_purchased: data.seats,
      amount_per_period: totalAmount,
      billing_period: data.billingCycle,
      next_billing_date: new Date(subscription.current_period_end * 1000),
      status: 'active'
    });

    return { organization: org, subscription, customer };
  }

  private getPricing(planType: string, cycle: string): number {
    const pricing = {
      basic: { monthly: 15, annual: 12 }, // $3/seat discount for annual
      professional: { monthly: 30, annual: 25 },
      enterprise: { monthly: 50, annual: 42 }
    };

    return pricing[planType][cycle];
  }

  // Handle Stripe webhooks
  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
    }
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription as string
    );

    // Update subscription status to active
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        next_billing_date: new Date(subscription.current_period_end * 1000)
      })
      .eq('stripe_subscription_id', subscription.id);

    // Update organization status
    await supabase
      .from('organizations')
      .update({ status: 'active' })
      .eq('id', subscription.metadata.organization_id);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    // Suspend organization after 3 failed attempts
    if (invoice.attempt_count >= 3) {
      await supabase
        .from('organizations')
        .update({ status: 'suspended' })
        .eq('id', invoice.subscription_metadata?.organization_id);

      // Send email to billing contact
      await this.sendPaymentFailureEmail(invoice);
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        next_billing_date: new Date(subscription.current_period_end * 1000)
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  private async handleSubscriptionCancelled(subscription: Stripe.Subscription) {
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('stripe_subscription_id', subscription.id);

    await supabase
      .from('organizations')
      .update({ status: 'cancelled' })
      .eq('id', subscription.metadata.organization_id);
  }
}
```

---

### Invoice Billing (Traditional B2B)

```
Manual Billing Process:

Step 1: Quote Generation
├─ School requests 500 seats
├─ You generate quote:
│  ├─ 500 seats × $25/month × 12 months = $150,000
│  ├─ Payment terms: Net 30/60
│  ├─ Discounts: 10% for annual prepayment = $135,000
│  └─ Valid for 30 days
└─ Send PDF quote via email

Step 2: Purchase Order (PO)
├─ School sends PO #12345 for $135,000
├─ PO includes:
│  ├─ Line items
│  ├─ Billing address
│  ├─ Payment terms
│  └─ Delivery requirements
└─ You accept PO (creates legal obligation)

Step 3: Contract Execution
├─ Master Service Agreement (MSA) signed
├─ Statement of Work (SOW) outlining:
│  ├─ 500 seats for Stanford University
│  ├─ 12-month term
│  ├─ Support SLA
│  └─ Renewal terms
└─ Both parties sign

Step 4: Invoice Generation
├─ Create invoice matching PO
├─ Invoice includes:
│  ├─ Your company details + tax ID
│  ├─ Their PO number
│  ├─ Line items with exact PO wording
│  ├─ Total: $135,000
│  ├─ Payment terms: Net 30
│  ├─ Wire/ACH instructions
│  └─ Due date
└─ Send via email + postal mail

Step 5: Activation
├─ Do NOT wait for payment to activate (trust Net 30 terms)
├─ Manually create organization in database:
│  ├─ INSERT INTO organizations ...
│  ├─ Status: 'active'
│  ├─ Contract end: 1 year from now
│  └─ Max seats: 500
├─ Send welcome email with:
│  ├─ Admin portal access
│  ├─ Onboarding schedule
│  └─ Support contacts

Step 6: Payment Collection
├─ School processes invoice (30-60 days)
├─ Payment received via:
│  ├─ Wire transfer
│  ├─ ACH
│  └─ Check (rare)
├─ Mark invoice as paid in accounting system
├─ Send payment confirmation

Step 7: Renewal (11 months later)
├─ Contact 90 days before expiration
├─ Send renewal quote
├─ Negotiate any changes
├─ Repeat process
```

**Tools for Invoice Billing:**
- **Accounting:** QuickBooks Online, NetSuite, Xero
- **CRM:** Salesforce, HubSpot (track quotes, POs)
- **Contract Management:** DocuSign, PandaDoc
- **Invoicing:** Bill.com, Invoice Ninja

---

## 7. Complete B2B Sales Flow

### Stage 1: Lead Generation

```
Inbound Marketing:
├─ Website: "For Universities" landing page
├─ Content: Case studies, whitepapers, webinars
├─ SEO: "Trading simulation for universities"
├─ Ads: Google Ads targeting "finance education software"
└─ Partnerships: AACSB, finance professor associations

Outbound Sales:
├─ Build list: Top 500 universities with finance programs
├─ Cold email: Finance department chairs
├─ LinkedIn: Connect with professors
└─ Conferences: Academic finance conferences

Lead Capture:
├─ Professor fills form: "Request Demo"
├─ CRM auto-creates lead (Salesforce/HubSpot)
└─ Sales rep assigned within 1 hour
```

---

### Stage 2: Qualification (BANT Framework)

```
Sales Call #1: Discovery (30 minutes)

Questions to Ask:
├─ Budget: "What's your annual software budget?"
├─ Authority: "Who approves software purchases?"
├─ Need: "What trading tools do you currently use?"
├─ Timeline: "When do you need this for your next semester?"

Qualification Criteria:
├─ ✅ Budget: >$50k/year available
├─ ✅ Authority: Talking to decision maker or influencer
├─ ✅ Need: Currently using subpar tools or nothing
├─ ✅ Timeline: Within 6 months
└─ If all ✅ → Move to demo

If not qualified:
└─ Nurture campaign (monthly emails, stay in touch)
```

---

### Stage 3: Demo & Trial

```
Demo Presentation (60 minutes):

Part 1: Problem (10 min)
├─ "Students learn trading theory but never practice"
├─ "Paper trading tools are disconnected from learning"
└─ "No way to track student progress or grade performance"

Part 2: Solution (30 min)
├─ Live demo of platform:
│  ├─ Student creates training account
│  ├─ AI trainer provides feedback
│  ├─ Professor views analytics dashboard
│  └─ Historical backtesting
└─ Emphasize unique AI-driven learning

Part 3: Proof (10 min)
├─ Case study: "UCLA saw 40% better exam scores"
├─ Testimonials from professors
└─ Student satisfaction data

Part 4: Next Steps (10 min)
├─ Offer 30-day trial:
│  ├─ 50 seats
│  ├─ Full features
│  ├─ Setup assistance
│  └─ Weekly check-ins
└─ Schedule trial start date

Trial Setup:
├─ Create trial organization in database
├─ Set expiration: 30 days
├─ Onboard professor + 10 pilot students
├─ Weekly usage reports
└─ Trial success metric: >70% student engagement
```

---

### Stage 4: Proposal & Negotiation

```
Proposal Creation:

Executive Summary:
├─ Overview of solution
├─ Key benefits for their institution
└─ Expected outcomes

Pricing:
├─ Recommended: Professional Plan
├─ 300 seats @ $25/seat/month
├─ Annual contract: $90,000
├─ Educational discount applied: 50% off commercial rate
└─ Payment options:
   ├─ Annual prepay: 10% discount = $81,000
   ├─ Quarterly: $22,500 per quarter
   └─ Monthly: $7,500 per month

What's Included:
├─ 300 concurrent student seats
├─ Unlimited professor/admin accounts
├─ All trading strategies
├─ Historical data access
├─ Priority email support
├─ Quarterly training webinars
└─ Annual feature updates

Implementation Plan:
├─ Week 1: Account setup & admin training
├─ Week 2: Pilot with 2 classes (50 students)
├─ Week 3-4: Full rollout
└─ Ongoing: Monthly check-in calls

Terms:
├─ 12-month initial term
├─ Auto-renew unless 90-day notice
├─ Price lock for 2 years
└─ SLA: 99.5% uptime

Negotiation Common Requests:
├─ "Can we get more seats?" → Yes, volume discount at 500+
├─ "Can we pay quarterly?" → Yes, but no annual discount
├─ "Can we do a perpetual license?" → Yes, $200k one-time
├─ "What about integration with Blackboard?" → Enterprise feature
└─ "We need FERPA compliance docs" → Provide compliance package
```

---

### Stage 5: Contract & Legal Review

```
Legal Documentation:

1. Master Service Agreement (MSA):
   ├─ Defines relationship
   ├─ Liability limitations (typically 1x annual fees)
   ├─ IP ownership (you own code, they own their data)
   ├─ Confidentiality
   ├─ Dispute resolution
   └─ Termination clauses

2. Order Form / SOW:
   ├─ Specific to this purchase
   ├─ 300 seats, Professional Plan
   ├─ $90,000 annual
   ├─ 12-month term
   └─ References MSA

3. Data Processing Agreement (DPA):
   ├─ Required for FERPA/GDPR
   ├─ How you handle student data
   ├─ Data retention policies
   └─ Security measures

Procurement Process:
├─ Week 1-2: Legal review by university counsel
├─ Week 3-4: Redlines and negotiation
├─ Week 5-6: Final approval
├─ Week 7-8: Signatures
└─ Total time: 2-6 months (typical for universities)

Common Legal Requests:
├─ Indemnification clauses
├─ Data breach notification requirements
├─ Right to audit
├─ Termination for convenience
└─ Insurance requirements ($1M+ liability)
```

---

### Stage 6: Onboarding & Implementation

```
Onboarding Timeline:

Week 1: Kickoff
├─ Kickoff call with IT, professors, admin
├─ Create organization account
├─ Set up admin portal access
├─ Provide admin training (1 hour webinar)
└─ Deliverable: Admin guide PDF

Week 2: Pilot
├─ Add 50 pilot students
├─ Professor creates first assignment
├─ Students complete onboarding
├─ Monitor usage daily
└─ Deliverable: Pilot success report

Week 3: Full Rollout
├─ Bulk import remaining 250 students
├─ CSV upload or SSO integration
├─ Send welcome emails to all students
├─ Professor training session #2 (advanced features)
└─ Deliverable: Full deployment confirmation

Week 4: Optimization
├─ Review usage analytics
├─ Address any issues
├─ Collect feedback survey
├─ Schedule monthly check-in
└─ Deliverable: Success metrics dashboard

Ongoing Support:
├─ Monthly: Usage reports emailed to admin
├─ Quarterly: Business review call (QBR)
├─ Annual: Renewal discussion (90 days before)
└─ 24/7: Email support (4-hour response time)
```

---

### Stage 7: Renewal & Expansion

```
Renewal Process (Starts 90 days before expiration):

Month -3: Initial Contact
├─ Email: "Your subscription renews in 90 days"
├─ Include: Usage statistics, ROI metrics
└─ Offer: Schedule renewal discussion

Month -2: Renewal Meeting
├─ Review past year success
├─ Discuss any issues
├─ Present renewal options:
│  ├─ Same plan: $90k (price increase 3%)
│  ├─ Upgrade to 500 seats: $135k (expansion)
│  └─ Multi-year: 2-year lock at current price
└─ Identify expansion opportunities

Month -1: Negotiation & Approval
├─ Send renewal quote
├─ Process through their procurement
├─ Sign renewal order form
└─ Update subscription in system

Expansion Triggers:
├─ Seat utilization >90% → Suggest upgrade
├─ Multiple departments interested → Enterprise plan
├─ Research use cases → API access upgrade
└─ New degree program → Additional seats

Churn Prevention:
├─ Low usage alerts → Outreach to re-engage
├─ Pricing concerns → Offer discounts or flexible terms
├─ Competitive threats → Highlight unique AI features
└─ Budget cuts → Reduce seats vs. full cancellation
```

---

## 8. Admin Portal Requirements

### Professor/Admin Dashboard Features

```
Dashboard Overview:

┌─────────────────────────────────────────────────┐
│ Stanford University - Trading Platform Admin    │
│ Contract: 300/300 seats used | Renews: 2027-03  │
└─────────────────────────────────────────────────┘

Section 1: User Management
├─ Add Students (CSV upload or manual)
├─ Remove Students
├─ View All Users:
│  ├─ Name, Email, Last Active, Total Trades
│  ├─ Filter by: Active/Inactive, Class, Performance
│  └─ Export to CSV
├─ Assign Roles:
│  ├─ Student (default)
│  ├─ TA (can view all students in their section)
│  └─ Professor (full admin access)
└─ Bulk Actions:
   ├─ Reset passwords
   ├─ Archive inactive users
   └─ Send announcements

Section 2: Usage Analytics
├─ Active Users: 285/300 (95%)
├─ Total Trades This Month: 12,450
├─ Average Trades per Student: 43.7
├─ Most Used Strategy: APAM (60%)
├─ Charts:
│  ├─ Daily active users (line chart)
│  ├─ Trading volume by strategy (pie chart)
│  └─ Student engagement heat map
└─ Export: Generate PDF report

Section 3: Performance Metrics
├─ Leaderboard:
│  ├─ Top 10 students by ROI
│  ├─ Top 10 by risk-adjusted returns
│  └─ Most improved this month
├─ Class Averages:
│  ├─ Average ROI: +12.4%
│  ├─ Win rate: 58%
│  ├─ Average risk per trade: 1.8%
│  └─ Compare to other institutions (anonymized)
└─ Individual Student Reports:
   ├─ Select student → View full trading history
   ├─ AI feedback log
   ├─ Strategy evolution
   └─ Export for grading

Section 4: Permissions & Settings
├─ Strategy Access:
│  ├─ ☑ APAM (Basic)
│  ├─ ☑ Fibonacci OR (Basic)
│  ├─ ☑ Trade Surge (Professional)
│  └─ ☐ Custom Strategies (Enterprise only)
├─ Risk Limits:
│  ├─ Max risk per trade: 2%
│  ├─ Max open positions: 5
│  └─ Daily loss limit: 5%
├─ Data Access:
│  ├─ Historical data: ☑ Enabled
│  ├─ Real-time data: ☐ Disabled (Enterprise feature)
│  └─ Export data: ☑ Enabled
└─ Notifications:
   ├─ Email weekly reports: ☑
   ├─ Alert on low engagement: ☑
   └─ Seat limit warnings: ☑

Section 5: Billing & Subscription
├─ Current Plan: Professional
├─ Seats: 300
├─ Cost: $7,500/month
├─ Next Billing: 2026-04-11
├─ Payment Method: Invoice (Net 30)
├─ Actions:
│  ├─ Request seat increase
│  ├─ Upgrade plan
│  ├─ Download invoices
│  └─ Update billing contact
└─ Usage This Month: 285 active users

Section 6: Assignments & Grading (Future Feature)
├─ Create Assignment:
│  ├─ Name: "Week 3: Momentum Trading"
│  ├─ Strategy: APAM only
│  ├─ Duration: 5 trading days
│  ├─ Goal: >5% ROI with <3% max drawdown
│  └─ Due Date: 2026-04-15
├─ View Submissions
├─ Auto-Grade based on performance
└─ Export grades to LMS (Blackboard, Canvas)
```

---

### Implementation

```typescript
// src/pages/AdminDashboard.tsx

export function OrganizationAdminDashboard() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    // Check if user is admin
    const { data: adminRecord } = await supabase
      .from('organization_admins')
      .select(`
        *,
        organizations (*)
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRecord) {
      // Not an admin
      return;
    }

    setOrganization(adminRecord.organizations);

    // Load organization users
    const { data: orgUsers } = await supabase
      .from('organization_users')
      .select(`
        *,
        auth.users (email, created_at)
      `)
      .eq('organization_id', adminRecord.organization_id);

    setUsers(orgUsers);

    // Load usage analytics
    loadAnalytics(adminRecord.organization_id);
  }

  async function loadAnalytics(orgId: string) {
    const { data } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('organization_id', orgId)
      .order('month', { ascending: false })
      .limit(6);

    setAnalytics(data);
  }

  async function addStudent(email: string) {
    // Check seat limit
    if (users.length >= organization.max_seats) {
      alert('Seat limit reached. Please upgrade your plan.');
      return;
    }

    // Create user account (or link existing)
    const { data: newUser } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: generateRandomPassword()
    });

    // Add to organization
    await supabase.from('organization_users').insert({
      organization_id: organization.id,
      user_id: newUser.id,
      role: 'student'
    });

    // Send welcome email
    await sendWelcomeEmail(email, organization.name);

    // Reload users
    loadAdminData();
  }

  return (
    <div>
      <header>
        <h1>{organization?.name} - Admin Dashboard</h1>
        <p>{users.length}/{organization?.max_seats} seats used</p>
      </header>

      <section>
        <h2>User Management</h2>
        <button onClick={() => setShowAddUserModal(true)}>
          Add Student
        </button>
        <UserTable users={users} onRemove={removeStudent} />
      </section>

      <section>
        <h2>Usage Analytics</h2>
        <AnalyticsCharts data={analytics} />
      </section>

      <section>
        <h2>Subscription</h2>
        <SubscriptionInfo organization={organization} />
      </section>
    </div>
  );
}
```

---

## 9. Legal/Corporate Structure

### Business Entity Formation

```
Entity Type: LLC or C-Corporation

LLC (Recommended for Starting):
├─ Pros:
│  ├─ Simpler formation ($100-500)
│  ├─ Pass-through taxation (no double tax)
│  ├─ Flexible ownership
│  └─ Less compliance burden
├─ Cons:
│  ├─ Can't issue stock options
│  ├─ Harder to raise VC funding
│  └─ Some states have higher LLC taxes (CA)
└─ Best for: Bootstrapped, small team, <$1M revenue

C-Corporation:
├─ Pros:
│  ├─ Can issue stock/options to employees
│  ├─ Easier to raise venture capital
│  ├─ Unlimited shareholders
│  └─ Perpetual existence
├─ Cons:
│  ├─ Double taxation (corporate + dividend)
│  ├─ More compliance (board meetings, bylaws)
│  ├─ Higher formation costs ($1k-2k)
│  └─ Annual franchise taxes
└─ Best for: High-growth, raising funding, >$2M revenue

Formation Steps:
1. Choose name: "TradingAI Education, LLC"
2. File Articles of Organization/Incorporation
   ├─ State: Delaware (most business-friendly) or home state
   ├─ Cost: $100-300
   └─ Timeline: 1-2 weeks
3. Get EIN (Employer Identification Number) from IRS
   ├─ Free, instant online
   └─ Required for bank account, taxes
4. Open business bank account
5. Create operating agreement (LLC) or bylaws (Corp)
```

---

### Required Contracts & Legal Documents

```
1. Master Service Agreement (MSA):

Purpose: Governs overall relationship with all customers

Key Sections:
├─ Definitions (what "Service", "User", "Data" mean)
├─ Grant of Rights:
│  ├─ You grant: Limited license to use platform
│  └─ They grant: Right to anonymize/aggregate their data
├─ Responsibilities:
│  ├─ Yours: Maintain uptime, support, updates
│  └─ Theirs: Comply with terms, pay on time
├─ Data Ownership:
│  ├─ You own: Platform code, AI models
│  └─ They own: Their student data, trading records
├─ Data Privacy:
│  ├─ FERPA compliance (for educational institutions)
│  ├─ GDPR compliance (if EU customers)
│  └─ How data is stored, encrypted, backed up
├─ Intellectual Property:
│  ├─ You retain all IP rights to platform
│  └─ They can't reverse engineer or resell
├─ Warranties:
│  ├─ You warrant: Platform works as described
│  └─ Disclaimer: No guarantee of trading profits (educational only)
├─ Liability Limitations:
│  ├─ Cap: Total liability limited to 12 months of fees paid
│  ├─ No consequential damages
│  └─ No liability for trading losses (education simulation)
├─ Indemnification:
│  ├─ You indemnify: Against IP infringement claims
│  └─ They indemnify: Against their users' misuse
├─ Term & Termination:
│  ├─ Term: Length of subscription
│  ├─ Termination for cause: Breach of terms
│  ├─ Termination for convenience: 90-day notice
│  └─ Post-termination: Data export, account deactivation
├─ Dispute Resolution:
│  ├─ Governing law: Delaware or your home state
│  ├─ Arbitration vs. litigation
│  └─ Venue: Your local jurisdiction
└─ Miscellaneous:
   ├─ Entire agreement
   ├─ Amendments
   └─ Force majeure

Cost: $2k-5k (lawyer to draft template)

---

2. Order Form / Statement of Work (SOW):

Purpose: Specific to each customer purchase

Template:
┌──────────────────────────────────────┐
│ Order Form #2024-001                 │
│ Customer: Stanford University        │
│ Date: 2024-03-11                     │
└──────────────────────────────────────┘

This Order Form is governed by the Master Service Agreement
dated [MSA date] between TradingAI Education, LLC ("Provider")
and Stanford University ("Customer").

Services:
├─ Platform: Trading AI Education Platform
├─ Plan: Professional
├─ Seats: 300 concurrent users
└─ Term: 12 months (2024-04-01 to 2025-03-31)

Fees:
├─ Subscription Fee: $90,000 per year
├─ Payment Schedule: Annual prepay or quarterly
├─ Late Fees: 1.5% per month on overdue amounts
└─ Taxes: Customer responsible for applicable taxes

Implementation:
├─ Start Date: 2024-04-01
├─ Onboarding: 2 weeks (included)
└─ Training: 2 hours (included)

Renewal:
├─ Auto-renews unless 90-day written notice
├─ Renewal rate: Current rate + 5% annual increase (capped)

Signatures:
Provider: _________________ Date: _______
Customer: _________________ Date: _______

---

3. Data Processing Agreement (DPA):

Purpose: Required for FERPA/GDPR compliance

Key Sections:
├─ Data Controller vs. Processor:
│  ├─ They are: Data Controller (own the data)
│  └─ You are: Data Processor (process on their behalf)
├─ Types of Data Processed:
│  ├─ Student PII: Name, email, student ID
│  ├─ Educational records: Trading history, performance
│  └─ Usage data: Login times, features used
├─ Purpose of Processing:
│  └─ Provide educational trading platform services
├─ Security Measures:
│  ├─ Encryption: At rest (AES-256) and in transit (TLS 1.3)
│  ├─ Access controls: Role-based, multi-factor auth
│  ├─ Monitoring: 24/7 security monitoring
│  └─ Backups: Daily, 30-day retention
├─ Data Retention:
│  ├─ Active subscriptions: Duration of contract
│  ├─ Post-termination: 30 days (for export), then deleted
│  └─ Backup retention: 30 days
├─ Sub-processors:
│  ├─ List all: Supabase (database), Vercel (hosting)
│  └─ Customer consent required for new sub-processors
├─ Data Breach Notification:
│  ├─ Timeline: Within 24 hours of discovery
│  ├─ Method: Email + phone call
│  └─ Information: Nature of breach, affected records, remediation
├─ Data Subject Rights:
│  ├─ Access: Students can request their data
│  ├─ Deletion: Right to be forgotten
│  ├─ Portability: Export data in standard format
│  └─ Timeline: Respond within 30 days
└─ Audit Rights:
   ├─ Customer can audit your security (annual)
   └─ Or accept SOC 2 report in lieu

---

4. Terms of Service (for end users - students):

Purpose: Agreement between platform and individual users

Key Sections:
├─ Acceptance: By using platform, you agree to these terms
├─ Eligibility: Must be 13+ or enrolled student
├─ Account Security: Keep password secure, don't share
├─ Acceptable Use:
│  ├─ Educational purposes only
│  ├─ No sharing strategies for commercial use
│  ├─ No automated trading or bots
│  └─ No harassment or abuse
├─ Intellectual Property:
│  ├─ Platform content is proprietary
│  ├─ Student can use for personal learning
│  └─ Can't redistribute or resell
├─ Disclaimers:
│  ├─ Platform is for education/simulation only
│  ├─ Not financial advice
│  ├─ Past performance doesn't guarantee future results
│  └─ Not responsible for trading losses
├─ Limitation of Liability:
│  └─ No liability for any financial losses
├─ Privacy Policy: Link to separate privacy policy
└─ Termination: We can suspend access for ToS violations

---

5. Privacy Policy (FERPA/GDPR compliant):

Purpose: Explain how you collect, use, store data

Required Sections:
├─ What Data We Collect:
│  ├─ Account info: Name, email, school
│  ├─ Usage data: Trading history, performance
│  └─ Technical: IP address, browser, cookies
├─ How We Use Data:
│  ├─ Provide platform services
│  ├─ Improve AI algorithms (anonymized)
│  ├─ Analytics and research (aggregated)
│  └─ Communication (account updates, support)
├─ How We Share Data:
│  ├─ With school: Professors/admins can see student data
│  ├─ With service providers: Supabase, Vercel (DPA in place)
│  └─ Legal: If required by law
├─ Student Rights (FERPA):
│  ├─ Students can access their records
│  ├─ Students can request corrections
│  └─ Schools control student data
├─ Data Security:
│  ├─ Encryption, access controls
│  └─ Regular security audits
├─ Data Retention:
│  └─ Retained during subscription + 30 days
├─ International Transfers (GDPR):
│  ├─ Data stored in US (or EU if EU customers)
│  └─ Standard Contractual Clauses (if applicable)
├─ Cookies:
│  ├─ Essential: Session management
│  ├─ Analytics: Google Analytics (opt-out available)
│  └─ Cookie consent banner (EU)
├─ Children's Privacy (COPPA):
│  ├─ Platform is for 13+ (or with school consent)
│  └─ Parental consent obtained via school
└─ Contact:
   └─ Email: privacy@yourcompany.com
```

**Legal Costs:**
- Initial package (all docs): $5k-10k
- Lawyer review per contract: $1k-2k
- Ongoing counsel (retainer): $2k-5k/month

**DIY Options:**
- Rocket Lawyer, LegalZoom: Template contracts ($500-1k)
- Termly, Iubenda: Privacy policy generators ($200-500)
- Risk: Not customized, may not hold up in dispute

---

### Required Insurance

```
1. General Liability Insurance:
├─ Coverage: $1M-$2M per occurrence
├─ Protects: Bodily injury, property damage claims
├─ Example: Someone sues claiming your software caused stress
├─ Cost: $500-1,000/year
└─ Required by: Most enterprise customers

2. Professional Liability (E&O - Errors & Omissions):
├─ Coverage: $1M-$2M per claim
├─ Protects: Software defects, data loss, service failures
├─ Example: Bug causes student to lose simulated money, sues
├─ Cost: $1,500-3,000/year
└─ Required by: Most SaaS contracts

3. Cyber Liability Insurance:
├─ Coverage: $1M-$5M per incident
├─ Protects: Data breaches, hacks, ransomware
├─ Covers: Notification costs, legal fees, regulatory fines
├─ Example: Database breach exposes 10,000 student records
├─ Cost: $2,000-5,000/year
└─ Required by: Universities handling student data

4. Workers Compensation (if you have employees):
├─ Coverage: Medical costs, lost wages for employee injuries
├─ Cost: Varies by state and payroll
└─ Required by: Law (if 1+ employees in most states)

Total Annual Insurance Cost: $4k-10k/year
```

**Where to Buy:**
- Hiscox (specializes in tech startups)
- Embroker
- CoverWallet
- Next Insurance

---

### Compliance Requirements

```
For Educational Institutions:

1. FERPA (Family Educational Rights and Privacy Act):
├─ Applies to: Any platform handling student education records
├─ Requirements:
│  ├─ Get written consent from school to access data
│  ├─ Don't share student data without school permission
│  ├─ Allow students to access/correct their records
│  ├─ Implement security safeguards
│  └─ Destroy data when no longer needed
├─ Penalties: Loss of federal funding for school (severe)
└─ How to Comply:
   ├─ Include FERPA language in MSA and DPA
   ├─ Train staff on FERPA requirements
   ├─ Implement data access controls
   └─ Annual FERPA compliance review

2. GDPR (General Data Protection Regulation):
├─ Applies to: Any EU customers or EU student data
├─ Requirements:
│  ├─ Legal basis for processing (contract, consent)
│  ├─ Data minimization (only collect what's needed)
│  ├─ Right to access, delete, port data
│  ├─ Data breach notification within 72 hours
│  ├─ Appoint DPO (Data Protection Officer) if large scale
│  └─ Cookie consent
├─ Penalties: Up to 4% of global revenue or €20M (whichever higher)
└─ How to Comply:
   ├─ Use Standard Contractual Clauses (SCCs) for data transfers
   ├─ Implement data subject request process
   ├─ Cookie consent banner
   ├─ GDPR-compliant privacy policy
   └─ Annual GDPR audit

3. COPPA (Children's Online Privacy Protection Act):
├─ Applies to: Platforms targeting kids under 13
├─ Requirements:
│  ├─ Parental consent before collecting data from <13
│  ├─ Or school/teacher consent (school acts in loco parentis)
│  └─ Don't use data for advertising
├─ Penalties: $43k per violation
└─ How to Comply:
   ├─ Terms state: "For ages 13+ or with school consent"
   ├─ School consents on behalf of students
   └─ No ads or third-party tracking for kids

4. SOC 2 Type II Certification (not required but requested by enterprises):
├─ What it is: Third-party audit of security controls
├─ When needed: Large universities (1000+ seats) often require
├─ Cost: $15k-50k (audit + preparation)
├─ Timeline: 6-12 months
└─ Alternative: Fill out security questionnaires (cheaper)

5. PCI-DSS (if you process credit cards directly):
├─ Applies to: If you store/process card data
├─ How to Avoid: Use Stripe (they're PCI-compliant)
└─ You become: PCI-compliant by proxy (SAQ-A)
```

---

## 10. Revenue Model Example

### Year 1 Projections (Conservative)

```
Target: 10 schools
Average Deal Size: 200 seats @ $20/seat/month

Revenue:
├─ Subscription Revenue:
│  ├─ 10 schools × 200 seats × $20/month × 12 = $480,000
│  └─ Payment: 6 annual, 4 quarterly
├─ Implementation Fees:
│  └─ 10 × $2,500 = $25,000
├─ Total Revenue: $505,000

Costs:
├─ Cost of Goods Sold (COGS):
│  ├─ Supabase: $500/month × 12 = $6,000
│  ├─ Vercel: $300/month × 12 = $3,600
│  ├─ Market data: $200/month × 12 = $2,400
│  └─ Total COGS: $12,000 (2.4% of revenue)
├─ Sales & Marketing:
│  ├─ Sales rep (contract): $60,000
│  ├─ Marketing (ads, content): $30,000
│  ├─ Conferences: $10,000
│  └─ Total S&M: $100,000 (19.8%)
├─ Operations:
│  ├─ Customer success manager: $70,000
│  ├─ Support tools (Intercom): $3,000
│  └─ Total Ops: $73,000 (14.5%)
├─ R&D (Development):
│  ├─ Your salary: $120,000
│  ├─ Contract developer: $50,000
│  └─ Total R&D: $170,000 (33.7%)
├─ General & Administrative:
│  ├─ Legal: $10,000
│  ├─ Accounting: $6,000
│  ├─ Insurance: $8,000
│  ├─ Software/tools: $5,000
│  └─ Total G&A: $29,000 (5.7%)
├─ Total Costs: $384,000

Net Profit: $121,000 (24% margin)

Metrics:
├─ CAC (Customer Acquisition Cost): $100k / 10 = $10,000 per school
├─ LTV (Lifetime Value): $48k × 3 years = $144k
├─ LTV:CAC Ratio: 14.4:1 (excellent, >3:1 is good)
├─ Gross Margin: 98% (typical for SaaS)
└─ Payback Period: 2.5 months
```

---

### Year 2 Projections (Growth Mode)

```
Target: 30 schools (20 new + 10 renewals)
Average Deal Size: 250 seats @ $22/seat/month (price increase)

Revenue:
├─ Subscription Revenue:
│  ├─ 30 schools × 250 seats × $22/month × 12 = $1,980,000
│  └─ Churn: Assume 10% → $1,782,000 net
├─ Expansion Revenue:
│  └─ 5 schools upgrade: +$50k
├─ Implementation Fees:
│  └─ 20 new × $2,500 = $50,000
├─ Total Revenue: $1,882,000

Costs:
├─ COGS:
│  ├─ Infrastructure: $2,500/month × 12 = $30,000
│  └─ Total COGS: $30,000 (1.6%)
├─ Sales & Marketing:
│  ├─ 2 Sales reps: $140,000
│  ├─ Marketing: $100,000
│  ├─ Conferences: $20,000
│  └─ Total S&M: $260,000 (13.8%)
├─ Operations:
│  ├─ 2 CSMs: $160,000
│  ├─ Support: $10,000
│  └─ Total Ops: $170,000 (9.0%)
├─ R&D:
│  ├─ 2 Engineers: $280,000
│  ├─ 1 Product manager: $130,000
│  └─ Total R&D: $410,000 (21.8%)
├─ G&A:
│  ├─ Legal: $15,000
│  ├─ Accounting: $12,000
│  ├─ Insurance: $10,000
│  ├─ Office/tools: $15,000
│  └─ Total G&A: $52,000 (2.8%)
├─ Total Costs: $922,000

Net Profit: $960,000 (51% margin)

Team Size: 7 people
```

---

### Year 3 Projections (Scale)

```
Target: 75 schools (45 new + 30 renewals, 90% retention)
Average: 300 seats @ $25/seat/month

Revenue:
├─ Subscription: 75 × 300 × $25 × 12 = $6,750,000
├─ Expansion: $200,000
├─ Implementation: 45 × $2,500 = $112,500
├─ Total Revenue: $7,062,500

Costs:
├─ COGS: $100,000 (1.4%)
├─ S&M: $1,200,000 (17%)
│  └─ 5 sales reps, 2 marketing, SDR team
├─ Ops: $500,000 (7%)
│  └─ 5 CSMs, support team
├─ R&D: $900,000 (12.7%)
│  └─ 6 engineers, 2 PMs, 1 designer
├─ G&A: $150,000 (2.1%)
├─ Total Costs: $2,850,000

Net Profit: $4,212,500 (60% margin)

Team Size: 20 people

Path to $10M ARR:
├─ 100 schools × 300 seats × $28/seat/month × 12
├─ Or 50 schools × 600 seats × $28
└─ Year 4-5 goal
```

---

### Key SaaS Metrics to Track

```
1. MRR (Monthly Recurring Revenue):
   └─ Total monthly subscription revenue
   └─ Track: New, Expansion, Contraction, Churned

2. ARR (Annual Recurring Revenue):
   └─ MRR × 12
   └─ Main metric for valuation

3. Churn Rate:
   ├─ Logo Churn: % of customers that cancel
   │  └─ Target: <5% annual (education has low churn)
   └─ Revenue Churn: % of revenue lost
      └��� Can be negative if expansion > churn

4. Customer Acquisition Cost (CAC):
   └─ Total S&M spend / New customers
   └─ Should decrease over time with brand

5. Lifetime Value (LTV):
   └─ Average revenue per customer × Average customer lifespan
   └─ Target: LTV:CAC > 3:1

6. Net Revenue Retention (NRR):
   └─ (Starting ARR + Expansion - Contraction - Churn) / Starting ARR
   └─ Target: >100% (means expansion > churn)

7. Gross Margin:
   └─ (Revenue - COGS) / Revenue
   └─ SaaS target: >80% (yours: 98%+)

8. Rule of 40:
   └─ Growth Rate % + Profit Margin %
   └─ Target: >40% (healthy SaaS business)
   └─ Example: 100% growth + 24% margin = 124 (excellent)
```

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Months 1-3)

```
Month 1: Legal & Infrastructure
Week 1-2:
├─ Form LLC/Corporation
├─ Open business bank account
├─ Get business insurance
└─ Hire lawyer for contracts

Week 3-4:
├─ Draft MSA template
├─ Draft DPA (FERPA-compliant)
├─ Write Terms of Service
└─ Create Privacy Policy

Month 2: Multi-Tenant System
├─ Implement database schema (organizations, subscriptions)
├─ Build subscription gate / access control
├─ Create feature flags system
├─ Add RLS policies for data isolation

Month 3: Admin Portal
├─ Build organization admin dashboard
├─ User management (add/remove students)
├─ Usage analytics views
├─ Billing information display

Deliverable: Platform ready for first pilot customer
```

---

### Phase 2: Sales Launch (Months 4-6)

```
Month 4: Sales Preparation
├─ Create sales deck (20 slides)
├─ Build demo environment
├─ Write case studies (even if hypothetical)
├─ Set up CRM (HubSpot free tier)
├─ Create pricing page on website

Month 5: Outbound Sales
├─ Build list of 100 target universities
├─ Cold email campaign (10 per day)
├─ LinkedIn outreach to finance professors
├─ Apply to academic conference booths

Month 6: First Customers
├─ Goal: 3 pilot customers
├─ Offer: 50% discount for first year
├─ Focus: Get testimonials, refine onboarding
└─ Revenue: ~$50k ARR

Deliverable: 3 paying customers, proven sales process
```

---

### Phase 3: Scale (Months 7-12)

```
Month 7-9: Team Building
├─ Hire sales rep (commission-based initially)
├─ Hire customer success manager
├─ Document sales playbook
└─ Document onboarding process

Month 10-12: Growth
├─ Goal: 10 total customers
├─ Launch annual billing option (10% discount)
├─ Implement Stripe billing for self-service
├─ Create self-service trial signup
└─ Revenue: $300k ARR

Deliverable: Product-market fit, repeatable sales process
```

---

### Phase 4: Enterprise Features (Year 2)

```
Q1: SSO & Advanced Security
├─ SAML/SSO integration
├─ SOC 2 Type II audit (begin process)
├─ Advanced permissions system
└─ Audit logging

Q2: Scalability
├─ Performance optimization (>1000 concurrent users)
├─ Advanced analytics
├─ API access for integrations
└─ LMS integration (Blackboard, Canvas)

Q3-Q4: Enterprise Sales
├─ Target larger institutions (1000+ seats)
├─ Hire enterprise sales rep
├─ Create enterprise tier pricing
└─ Goal: $2M ARR

Deliverable: Enterprise-ready platform, $2M ARR
```

---

## Summary: Recommended Approach

### Quick Start Checklist

```
☐ 1. Form business entity (LLC)
☐ 2. Get business bank account + insurance
☐ 3. Implement multi-tenant database schema
☐ 4. Build subscription gate / access control
☐ 5. Create admin portal (basic)
☐ 6. Get lawyer to draft MSA + DPA templates
☐ 7. Create pricing page ($20/seat/month, 100-seat min)
☐ 8. Build list of 50 target universities
☐ 9. Create sales deck + demo
☐ 10. Reach out to first 10 prospects
☐ 11. Offer pilot program (3 schools, 50% off)
☐ 12. Gather testimonials
☐ 13. Scale to 10 customers in Year 1
☐ 14. Hire sales + support team
☐ 15. Path to $1M ARR by Year 2
```

---

### Competitive Positioning

```
Your Unique Value Proposition:

"The only trading education platform with AI trainers that
learn from thousands of students across universities,
providing personalized feedback that adapts to each student's
learning style and trading patterns."

vs. Competitors:
├─ vs. Tradier/TD Ameritrade Paper Trading:
│  ├─ They have: Real broker integration
│  └─ You have: AI-driven learning, curriculum integration
│
├─ vs. Investopedia Simulator:
│  ├─ They have: Large user base, brand recognition
│  └─ You have: Academic features, professor controls, AI
│
├─ vs. Traditional Textbooks:
│  ├─ They have: Established curriculum
│  └─ You have: Hands-on practice, real-time feedback
│
└─ vs. Building In-House:
   ├─ They would need: 2 years, $500k development
   └─ You have: Ready now, $20k/year

Target Customer:
├─ Primary: Finance departments at universities
├─ Secondary: Business schools, economics programs
├─ Tertiary: Trading bootcamps, financial literacy nonprofits

Go-to-Market:
├─ Initial: Direct sales (email, LinkedIn, conferences)
├─ Growth: Partner with textbook publishers (bundling)
├─ Scale: Academic marketplace listings (EDUCAUSE)
```

---

### Financial Model Summary

```
Pricing: $20-30/seat/month (educational discount from $50 commercial)
Contract: Annual preferred, quarterly accepted
Minimum: 100 seats ($24k annual minimum)

Year 1: 10 schools × 200 seats = $480k revenue, $120k profit
Year 2: 30 schools × 250 seats = $1.8M revenue, $960k profit
Year 3: 75 schools × 300 seats = $6.7M revenue, $4.2M profit

Path to Exit:
├─ $10M ARR = $100M valuation (10x ARR for SaaS)
├─ Or strategic acquisition by:
│  ├─ Pearson, Wiley (textbook publishers)
│  ├─ Coursera, Udemy (education platforms)
│  └─ Bloomberg, Thomson Reuters (financial data)
└─ Timeline: 4-5 years
```

---

## The moat: aggregated learning across tenants (optional product strategy)

```
Conceptual network advantage:

As more institutions participate (only where privacy policy and contracts allow pooled analytics):
├─ Larger aggregate sample → richer pattern libraries → better educational outcomes
├─ Institutions still retain isolated tenant data by default
└─ Any cross-tenant learning must be explicit, consent-based, and compliant

Parallel analogies:
├─ Duolingo: More learners → Better language models
├─ Grammarly: More writers → Better grammar detection
└─ Trading education: More structured practice → Better feedback loops
```

---

**END OF DOCUMENT**
