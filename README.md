# Field Core

Build Stage 1 of a mobile-first contractor project management app.

Goal

Create the authentication experience and basic protected app shell only.

Do not build projects, calendar, photos, team management, CMS controls or Google Drive integration yet.

Technology

Use:

React

TypeScript

Tailwind CSS

Supabase Authentication

Supabase database

Responsive mobile-first design

Use the existing project structure where possible. Do not replace working code unnecessarily.

Design Style

Use a premium contractor operating-system style:

Dark navy background

Warm gold accent colour

White and soft-grey text

Clean, bold typography

Rounded cards and input fields

Subtle borders and shadows

Professional and cinematic

Large touch-friendly mobile controls

Consistent spacing throughout

The interface should feel polished, secure and easy to use on a phone.

Authentication Methods

Create a login page supporting:

Continue with Google

Sign in with email and password

Create an account

Forgot password

Use Supabase Auth for both Google and email authentication.

Login Screen

Display:

App logo placeholder

“Welcome back”

Supporting text: “Sign in to manage your projects and team.”

Continue with Google button

Divider with “or”

Email field

Password field

Show or hide password control

Sign In button

Forgot password link

Create account link

Include clear loading, success and error states.

Create Account Screen

Include:

Full name

Email address

Password

Confirm password

Create Account button

Continue with Google option

Link back to Sign In

Validate:

Valid email address

Matching passwords

Minimum secure password requirements

Required fields

After email registration, show a message asking the user to verify their email.

Password Reset

Create a password reset screen where the user can:

Enter their email address

Request a secure reset link

See a clear confirmation message

Protected App Shell

After successful login, redirect the user to a protected placeholder screen called:

“Control Centre”

For now, this page should contain:

Welcome message using the user’s name

Profile avatar or initials

Sign Out button

Placeholder card saying: “Your contractor workspace will appear here.”

Mobile bottom navigation placeholder

The bottom navigation should contain:

Home

Projects

Large raised Camera button in the centre

Calendar

More

The Projects, Camera, Calendar and More buttons do not need to work yet.

User Profile

Create a profiles table linked to the Supabase authenticated user.

Include:

id

full_name

email

avatar_url

created_at

updated_at

Automatically create a profile after a new user registers.

Security

Enable Row Level Security on the profiles table.

Users can only read and update their own profile.

Do not store passwords in the database.

Do not place Supabase service-role credentials in frontend code.

Protect the Control Centre route from logged-out users.

Redirect logged-out users back to the login page.

Redirect logged-in users away from the login page.

Google Authentication

Prepare Supabase Google OAuth authentication.

Use the Supabase OAuth sign-in method and return the user to the protected Control Centre after successful login.

Do not create a custom Google integration outside Supabase Auth.

Required States

Include polished states for:

Loading

Signing in

Invalid credentials

Email already registered

Verification email sent

Password reset requested

Google sign-in failure

Network error

Signed-out state

Completion Requirements

This stage is complete when:

A user can register with email and password.

A user can sign in with email and password.

A user can start Google sign-in.

A user can request a password reset.

Logged-in users can access the Control Centre.

Logged-out users cannot access protected pages.

A profile record is created for each user.

The design works cleanly on mobile and desktop.

The app uses the dark navy and warm gold design system consistently.

Do not add demo projects or unrelated features.

At the end, explain any Supabase dashboard setup still required, including the Google OAuth provider configuration and redirect URLs.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploying to Vercel

Import the repository into Vercel and leave the framework preset on the detected
TanStack Start setting. The standard `pnpm build` command emits Vercel Build
Output API files automatically when it runs on Vercel.

Configure these variables for Production, Preview, and Development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

If trusted server-side admin operations are enabled, also configure
`SUPABASE_SERVICE_ROLE_KEY`. Never expose that value with a `VITE_` prefix.

In Supabase Authentication settings, add the production Vercel domain and any
required preview domains to the allowed redirect URLs so OAuth and password
recovery callbacks can return to the app.
