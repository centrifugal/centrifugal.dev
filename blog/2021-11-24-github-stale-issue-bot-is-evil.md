---
title: Stale issue close GitHub action is evil (by default)
tags: [random]
description: In this post I want to share some thinking about Stale Github bot/action which closes inactive issues automatically.
author: Alexander Emelin
authorTitle: Centrifugo author
authorImageURL: https://github.com/FZambia.png
image: /img/stale_cover.png
hide_table_of_contents: false
---

![stale_cover](/img/stale_cover.png)

Have you ever found an issue on GitHub which you are really interested in? You come to Github issues, filter issues with the hope to find the relevant information or the solution to the bug you are experiencing.

And you find it. The title is really what you are looking for. The issue marked `closed`. You are very excited! Closed issue is a sign of having a solution to your problem.

<!--truncate-->

You are reading discussion in comments.

You feel that each comment gets you closer to the solution. To the advice you are eager for.

But then – you see this:

![stale_bot](/img/stale_bot.png)

Doh... No resolution. No final comment from repo maintainers. Nothing.

### When this bot can be useful

All OSS project maintainers know that nothing beats more than an issue in your project with zero description. Attempt to open a bug report without putting at least a minimal effort to help project maintainers reproduce the bug, understand the conditions when it happens, prove that bug is in repository provided software – and not in the op's application code. Attempt to ask a question without trying to explain why this question araised.

In this case maintainer can put the label `waiting for information` to the issue and if the op have not provided any additional information in a reasonable time – well, stale bot can close this. This is fine.

There are many options in Github stale action which allow tweaking action behavior. For example, [any-of-labels](https://github.com/actions/stale#any-of-labels) to only apply workflow to certain issues.

There are people who remove GitHub issue templates, not trying to minimally follow it. There are people who think issue title is the only required field. Let robots deal with them!

### But in other cases?

I think in most other cases closing an properly formatted issue should be performed manually. If possible – with a resolution message. Otherwise, it's really annoying for the op and for the strangers in the future.

Here is a link to filter out issues closed by the Stale bot or via Github Action:

https://github.com/search?q=This+issue+has+been+automatically+marked+as+stale&type=issues

More than 400k closed at this point. If you read some of them you will find many frustrating issue closes.
