---
description: "Configure SSO for Centrifugo PRO admin UI using OpenID Connect (OIDC) with identity providers like Okta, Keycloak, and Azure."
id: admin_idp_auth
sidebar_label: SSO for admin UI (OIDC)
title: SSO for admin UI using OpenID connect (OIDC)
---

Centrifugo PRO admin UI integrates with OpenID Connect (OIDC) identity providers such as Okta, Keycloak, Google Workspace and Azure, so admins log in through your existing Single Sign-On infrastructure.

The feature is described on the [Admin UI](./admin_ui.md#sso-for-admin-ui-oidc) page, which covers:

* [Configuration](./admin_ui.md#configuration) – the `admin.oidc` options and the `access_cel` expression deciding who may log in.
* [Roles](./admin_ui.md#roles) – `admin` and `viewer` roles given by rules over token claims.
* [Server-side OIDC](./admin_ui.md#configuring-server-side-oidc) – the flow with a client secret, when the identity provider does not allow PKCE.
* [Audit log](./admin_ui.md#audit-log) – who did what in the admin UI.
