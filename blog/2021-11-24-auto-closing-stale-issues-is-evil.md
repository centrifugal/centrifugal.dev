---
title: Automatic closing of stale issues is pure evil (by default)
tags: [random]
description: In this post, I'd like to share some thoughts I have about stale Github bots/actions which close inactive issues automatically. Such bots are very popular these days – but they can result in developer's frustration.
author: Alexander Emelin
authorTitle: Centrifugo author
authorImageURL: https://github.com/FZambia.png
image: /img/stale_cover.png
hide_table_of_contents: false
---

![stale_cover](/img/stale_cover.png)

This wrap-up is relevant to almost every developer. These days we deal a lot with open-source software, specifically with GitHub. One helpful approach many of us use when looking for information not found in documentation or when trying to find out the reason for a bug – is coming to GitHub and filtering issues in the project. Using the keywords or error description. With the hope to find an already existing issue that sheds the light on our question.

And we find it. The issue with a title that is really what we are looking for. The issue is marked `closed`. We are excited – a closed issue is a sign of having a solution to a problem.

<!--truncate-->

We are reading the discussion in the comments. Feeling that each comment gets us closer to the solution. To the advice, we are eager for.

But then – we see this:

![stale_bot](/img/stale_bot.png)

Doh... No resolution. No final comment from repo maintainers. Nothing. Frustrating...

Here is a link to filter out issues closed by the Stale bots or via Github Action:

https://github.com/search?q=This+issue+has+been+automatically+marked+as+stale&type=issues

More than 400k closed at this point. Maybe more, since there are some different variations of such bots. If you read some of those issues you will find many frustrations from users caused by automatic close. Not every closed issue there causes confusion though – I'll try to talk a bit about normal usage scenarios for stale bots below.

Just a couple of examples that hurt me personally. The first case is an issue in Etcd about documenting RawNode to achieve multi-raft with the Etcd Raft library. [Here is that issue](https://github.com/etcd-io/etcd/issues/4932). If you look closer you will notice that several other similar issues were closed due to being a duplicate to this one. At it was finally closed by a bot without any resolution.

Or let's look at a couple of issues in Istio Github issue tracker: [first](https://github.com/istio/istio/issues/33534) and [second](https://github.com/istio/istio/issues/29427). They signal about the same problem I also came across in Centrifugo Helm chart recently. Several other issues linked there that discuss the same problem. Again - closed without resolution by a policy bot.

And those are only two examples I came across **during the last week**. Believe me - I am not alone, and if you don't feel my pain at the moment – I promise you'll be in the same boat with me soon!

### When stale bots are useful

All OSS project maintainers know that nothing beats more than an issue in project with zero description. Attempt to open a bug report without putting at least a minimal effort to help with reproducing steps, understand the conditions when it happens, prove that the bug is in repository-provided software – and not in the op's application code. Attempt to ask a question without any context and explanation why this question araised.

In this case, the maintainer can put the label `waiting for information` to the issue. If the op has not provided any additional information in a reasonable time – well, a stale bot can close this. This is totally fine.

There are many options in Github stale action which allow tweaking action behavior. For example, [any-of-labels](https://github.com/actions/stale#any-of-labels) only apply workflow to certain issues.

Some people remove GitHub issue templates, not trying to minimally follow it. Some people think issue title is the only required field. Let robots deal with them!

### But for normal issues and pull requests?

I think in most other cases closing a properly formatted issue or pull request should be performed manually by maintainers. If possible – with a resolution message. Even if the resolution sounds like `this is out of the scope for this project`, or `nothing actionable left here, so closing`, and so on.

I call everyone to avoid using stale bot/actions without taking into account labels or some other mechanisms which can help to avoid frustration for users when the "normal" issue closed without any resolution.
