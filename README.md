<div align="center">
  
  <a href="https://github.com/Newpixel-net/vibexe"><img src="https://img.shields.io/github/stars/vibexe-ai/vibexe.svg?style=social&label=Star" alt="GitHub stars" style="margin-right: 5px;"></a>  <img src="https://img.shields.io/badge/License-Apache2.0-blue.svg" alt="License" style="margin-right: 5px;">
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>

  
  <img src="./docs/assets/vibexe-logo-light.svg#gh-light-mode-only" alt="Vibexe logo" height="100">
  <img src="./docs/assets/vibexe-logo-dark.svg#gh-dark-mode-only" alt="Vibexe logo" height="100">

  
  <span style="font-size: 18px; color: #666; margin-left: 15px;">the AI agent studio powering product delivery</span>


  <p>
    <a href="https://www.producthunt.com/products/vibexe?embed=true&amp;utm_source=badge-top-post-badge&amp;utm_medium=badge&amp;utm_campaign=badge-vibexe" target="_blank" rel="noopener noreferrer"><img alt="Vibexe - Build and run AI workflows. Open source. | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=924550&amp;theme=light&amp;period=daily&amp;t=1767082208449"></a>
    <a href="https://www.producthunt.com/products/vibexe?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-vibexe" target="_blank" rel="noopener noreferrer"><img alt="Vibexe - Build and run AI workflows. Open source. | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=924550&amp;theme=light&amp;t=1767667659741"></a>
    <a href="https://www.producthunt.com/products/vibexe?embed=true&amp;utm_source=badge-top-post-badge&amp;utm_medium=badge&amp;utm_campaign=badge-vibexe" target="_blank" rel="noopener noreferrer"><img alt="Vibexe - Build and run AI workflows. Open source. | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=924550&amp;theme=light&amp;period=weekly&amp;t=1767667659741"></a>
  </p>

  <!-- Demo Video -->
 <img src="./docs/assets/introducing.gif" alt="Vibexe Video" width="100%"> <br/>

▶︎▶︎ [The YouTube video with audio can be found here](https://www.youtube.com/watch?v=g1siFWk0GNs) ◀︎◀︎


  <!-- Light/Dark Mode GIFs -->
  <img src="./docs/assets/copy-light.gif#gh-light-mode-only" alt="Vibexe Demo" width="400"> <br/>
  <img src="./docs/assets/copy-dark.gif#gh-dark-mode-only" alt="Vibexe Demo" width="400">

</div>

## 👋 Introduction

Vibexe is an open source AI for agentic workflows, enabling seamless human-AI collaboration.



## ⚡ Quick Start

Get Vibexe running locally in under 2 minutes:

```bash
# Clone the repository
git clone https://github.com/Newpixel-net/vibexe.git
cd vibexe

# Install dependencies
pnpm install

# Create environment file
touch .env.local

# Add your API key (at least one required)
echo 'OPENAI_API_KEY="your_openai_api_key_here"' >> .env.local

# Start development server
pnpm turbo dev
```

Open [http://localhost:3000](http://localhost:3000) and start building your AI agents!

> **Note**: You need at least one AI provider API key. Supported providers: OpenAI, Anthropic, Google AI.

## ✨ Features

<div align="center">

<img src="./docs/assets/featured/pdt1.png" width="100" alt="GitHub AI Operations" style="margin-right: 25px;">&nbsp;&nbsp;&nbsp;
<img src="./docs/assets/featured/pdt2.png" width="100" alt="Visual Agent Builder" style="margin-right: 25px;">&nbsp;&nbsp;&nbsp;
<img src="./docs/assets/featured/pdt3.png" width="100" alt="Multi-Model Composition" style="margin-right: 25px;">&nbsp;&nbsp;&nbsp;
<img src="./docs/assets/featured/pdt4.png" width="100" alt="Knowledge Store" style="margin-right: 25px;">&nbsp;&nbsp;&nbsp;
<img src="./docs/assets/featured/pdt5.png" width="100" alt="Team Collaboration" style="margin-right: 25px;">&nbsp;&nbsp;&nbsp;
<img src="./docs/assets/featured/pdt6.png" width="100" alt="Template Hub">

</div>

- **⚡ GitHub AI Operations** - Automates issues, PRs, and deployments with AI
- **🎨 Visual Agent Builder** - Create and modify agents in minutes using an intuitive drag-and-drop interface
- **🤖 Multi-Model Composition** - Leverage GPT, Claude, Gemini, and more—agents select the best model for each task
- **📁 Knowledge Store** - Access and search your code and data from one place. GitHub vector store integration supported
- **👥 Team Collaboration** - Design agents collaboratively with shared configurations and contextual awareness *(In Development)*
- **🚀 Template Hub** - Kickstart projects with one-click agent templates—contributed by the community *(In Development)*

## 🎯 Use Cases

- **📚 Research Assistant** - Automatically gather information from web and internal docs
- **🔍 Code Reviewer** - AI-powered code review that integrates with your GitHub workflow  
- **📄 Document Generator** - Auto-create PRDs, specs, and release notes from your codebase
- **🔄 Workflow Automator** - Chain multiple AI models to handle complex business processes

## 🚀 Using Vibexe

### ☁️ Cloud

We host [Vibexe](https://vibexe.ai/) as a cloud service for anyone to use instantly. It has all the same features as the self-hosted version, and includes 30 minutes of free Agent time per month in the free plan.

### 🏠 Self-hosting

Follow this [starter guide](CONTRIBUTING.md#development-environment-setup) to get Vibexe running in your environment.

### 🎵 Vibe Coding Guide

If you're using AI coding assistants like Claude, Cursor, or WindSurf to help build with Vibexe, check out our [Vibe Coding Guide](/docs/vibe/01-introduction.md). This guide explains:

- What is vibe coding and how to approach it effectively
- How to set up your Node.js environment and install dependencies
- Understanding Vibexe's project structure
- Running the playground and connecting to LLM providers

Designed for both developers and non-engineers, this guide will help you harness the power of AI to build with Vibexe without needing traditional coding expertise.

## 🗺️ Roadmap

Vibexe is currently still in active development. The roadmap for the public repository is currently being created, and once it's finalized, we will update this README accordingly.

## 🤝 Contributing

Your contributions — big or small — help Vibexe evolve and improve. Interested in joining us?

Here's how you can contribute:

- Star this repo ⭐
- Follow us on social media: [Facebook](https://www.facebook.com/VibexeAI/), [X](https://x.com/Vibexes_AI), [Instagram](https://www.instagram.com/vibexe_de_ai) and [YouTube](https://www.youtube.com/@Vibexe_AI)
- [Report a bug](https://github.com/Newpixel-net/vibexe/issues/new?template=1_bug_report.yml) you encounter while using Vibexe
- [Request a feature](https://github.com/Newpixel-net/vibexe/discussions/categories/ideas) you think would be helpful
- [Submit a pull request](CONTRIBUTING.md#how-to-submit-a-pull-request) if you'd like to add new features or fix bugs

For more details, please see our [contributing guide](CONTRIBUTING.md).

## 📄 License

Vibexe is licensed under the [Apache License Version 2.0](LICENSE).

Licenses for third-party packages can be found in [docs/packages-license.md](docs/packages-license.md).
