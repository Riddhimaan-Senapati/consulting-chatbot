# Consulting Chatbot

## Overview

The **Consulting Chatbot** is an AI-powered tool designed to assist small businesses with strategic analysis and decision-making. It performs **SWOT** (Strengths, Weaknesses, Opportunities, and Threats), **PESTLE** (Political, Economic, Social, Technological, Legal, and Environmental), **TOWS** (an advanced SWOT analysis), **Porter's Five Forces**, and **Business Model Canvas** analyses. Additionally, it provides **real-time business insights** by leveraging web-sourced information.

## Objective

The primary goal of this project is to create an intelligent and accessible consulting chatbot that helps small businesses and entrepreneurs make informed strategic decisions without the high costs associated with professional consulting services.

## Intended Audience

This chatbot is tailored for:
- **Small business owners**
- **Entrepreneurs**
- **Startups**  
who need strategic business insights but may lack the resources to hire professional consultants.

## Motivation and Goals

Hiring business consultants can be **expensive** and often out of reach for small businesses. However, with the advancement of **Generative AI**, many consulting tasks can be replicated and automated **at a fraction of the cost** and with **greater efficiency**. This project aims to **democratize access to critical business insights**, enabling small businesses to compete more effectively.

## Features

- **Automated Strategic Analysis**  
  - **SWOT Analysis** – Identifies strengths, weaknesses, opportunities, and threats.  
  - **PESTLE Analysis** – Evaluates external macroeconomic factors.  
  - **TOWS Analysis** – Develops strategic recommendations based on SWOT insights.  
  - **Porter's Five Forces Analysis** – Assesses industry competition and attractiveness through five key forces: competitive rivalry, threat of new entrants, bargaining power of suppliers, bargaining power of buyers, and threat of substitutes.
  - **Business Model Canvas Analysis** – Provides a comprehensive view of a business model through nine building blocks: customer segments, value propositions, channels, customer relationships, revenue streams, key resources, key activities, key partnerships, and cost structure.

- **Strategy Plans Board**  
  - **Create, track, and manage your strategic plans** with a visual board divided into three sections: To Do, In Progress, and Done.  
  - **Add new plans** directly from the board, move them between stages, and mark them as complete to stay accountable.  
  - **Complements the chatbot's strategy features** by helping you turn AI-generated insights and recommendations into actionable tasks that you can organize and complete.  
  - Access the board from the main navigation as "Plans Board".

- **Real-Time Business Insights**  
  - Leverages **web-sourced** data to provide up-to-date information.  
  - Helps businesses adapt to market changes in real time.  
  - Includes **source links** for all analyses, allowing users to verify information and explore topics further.

- **AI-Powered Decision Support**  
  - Offers **actionable recommendations** based on data-driven insights.  
  - Enhances strategic planning and risk assessment.  


## Installation & Usage

1. Clone the repository:
   ```sh
   git clone https://github.com/Riddhimaan-Senapati/consulting-chatbot.git
   ```

2. Navigate to the backend directory and follow the instructions in the [backend README](backend/README.md):
   ```sh
   cd consulting-chatbot/backend
   # Follow the instructions in the backend README
   ```

3. Open another terminal window, navigate to the frontend directory, and follow the instructions in the [frontend README](frontend/README.md):
   ```sh
   cd consulting-chatbot/frontend
   # Follow the instructions in the frontend README
   ```
4. Or if you have docker installed then run the following command in the main repo:
   ```sh
   docker-compose up --build
   ```