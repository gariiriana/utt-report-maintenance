# Framework Detection Reference

Companion to `steps/phase-00-discovery.md §0.5`. One signal per row. First
match wins unless otherwise noted.

**Convention.** Evidence strings are file paths with an optional `:pattern`
suffix so downstream phases can re-verify.

## Python

| Framework | Signal |
|---|---|
| Django | `settings.py` with `INSTALLED_APPS`, or `django>=` in `requirements.txt`/`pyproject.toml` |
| DRF | `djangorestframework` in requirements; `rest_framework` in `INSTALLED_APPS` |
| Flask | `from flask import Flask` or `flask>=` in requirements |
| FastAPI | `from fastapi import FastAPI` or `fastapi>=` in requirements |
| Starlette | `from starlette` imports (often via FastAPI) |
| Quart | `quart>=` in requirements |
| Tornado | `tornado>=` in requirements |
| Sanic | `sanic>=` in requirements |
| aiohttp | `aiohttp>=` + server usage |

## Java / Kotlin

| Framework | Signal |
|---|---|
| Spring Boot | `spring-boot-starter-*` in `build.gradle*` / `pom.xml` |
| Micronaut | `micronaut-*` dependencies |
| Quarkus | `quarkus-*` dependencies; `application.properties` with quarkus keys |
| Ktor | `io.ktor:ktor-*` dependencies |
| Javalin | `io.javalin:javalin` dependency |
| Vert.x | `io.vertx:vertx-*` dependencies |

## Go

| Framework | Signal |
|---|---|
| stdlib net/http | presence of `net/http` imports with `http.HandleFunc` / `ServeMux` |
| Gin | `github.com/gin-gonic/gin` in `go.mod` |
| Echo | `github.com/labstack/echo/v4` (or v3) |
| Chi | `github.com/go-chi/chi` |
| Fiber | `github.com/gofiber/fiber/v2` |
| gRPC | `google.golang.org/grpc` + `.proto` files |

## Ruby

| Framework | Signal |
|---|---|
| Rails | `gem 'rails'` in `Gemfile`, `config/application.rb` |
| Sinatra | `gem 'sinatra'` |
| Hanami | `gem 'hanami'` |
| Grape | `gem 'grape'` |

## PHP

| Framework | Signal |
|---|---|
| Laravel | `laravel/framework` in `composer.json` |
| Symfony | `symfony/*` in `composer.json` |
| Slim | `slim/slim` in `composer.json` |
| WordPress | `wp-config.php` or `wp-content/` present |
| CodeIgniter | `codeigniter4/framework` |

## .NET

| Framework | Signal |
|---|---|
| ASP.NET Core | `Microsoft.AspNetCore.*` in `*.csproj` |
| Blazor (Server/WASM) | `@page` directives in `.razor` files |
| Minimal APIs | `app.MapGet` / `app.MapPost` in `Program.cs` |

## Rust

| Framework | Signal |
|---|---|
| Axum | `axum` in `Cargo.toml` |
| Actix-web | `actix-web` in `Cargo.toml` |
| Rocket | `rocket` in `Cargo.toml` |
| Warp | `warp` in `Cargo.toml` |
| Poem | `poem` in `Cargo.toml` |

## Elixir / Erlang

| Framework | Signal |
|---|---|
| Phoenix | `phoenix` in `mix.exs`; `lib/<app>_web/router.ex` |
| Plug (alone) | `plug` in `mix.exs` without phoenix |

## Scala

| Framework | Signal |
|---|---|
| Play | `play-*` dependencies in `build.sbt` |
| Akka HTTP / Pekko | `akka-http` / `pekko-http` |
| http4s | `http4s-*` dependencies |

## JavaScript / TypeScript

| Framework | Signal (in `package.json` `dependencies` or `devDependencies`) |
|---|---|
| Next.js | `next` |
| Nuxt | `nuxt` |
| Remix | `@remix-run/*` |
| SvelteKit | `@sveltejs/kit` |
| Astro | `astro` |
| Express | `express` |
| Fastify | `fastify` |
| Hono | `hono` |
| Koa | `koa` |
| tRPC | `@trpc/server` |
| NestJS | `@nestjs/core` |
| AdonisJS | `@adonisjs/core` |
| Hapi | `@hapi/hapi` |

## Config-only / meta frameworks

These don't imply HTTP handlers but tell you the topology:

| Tool | Signal |
|---|---|
| Turborepo | `turbo.json` |
| Nx | `nx.json` |
| pnpm workspaces | `pnpm-workspace.yaml` |
| Lerna | `lerna.json` |
| Bazel | `WORKSPACE`, `MODULE.bazel` |

## Non-English note

These patterns assume English identifiers in manifest files. Framework names
themselves are stable across locales, but detection of per-handler
conventions may miss in non-English codebases. This is a known limitation;
document it in the final report when relevant.
