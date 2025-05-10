from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, START, END
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_google_genai import ChatGoogleGenerativeAI
import os
import re
from dotenv import load_dotenv
load_dotenv()

class ConversationState(TypedDict):
    messages: list
    input: str

def initialize_workflow():
    # Initialize AI components
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-pro-exp-02-05")
    search_tool = TavilySearchResults(max_results=5)

    # Create workflow graph
    workflow = StateGraph(ConversationState)
    
    # Function to sanitize markdown responses
    def sanitize_markdown(text):
        # Remove any accidental triple backticks that might wrap the entire response
        text = re.sub(r'^```markdown\s*', '', text)
        text = re.sub(r'^```md\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        
        # Ensure proper spacing for markdown elements
        text = re.sub(r'(?<!\n)#{1,6}\s', r'\n\g<0>', text)  # Add newline before headers if missing
        
        return text.strip()
    
    # Function to format source links in markdown with numbered citations
    def format_source_links(results):
        if not results:
            return ""
            
        sources = []
        seen_urls = set()
        
        for i, result in enumerate(results, 1):
            try:
                # Extract URL and title from each result
                url = None
                title = None
                metadata = {}
                
                if isinstance(result, dict):
                    if 'url' in result and 'title' in result:
                        url = result['url']
                        title = result['title']
                        metadata = result.get('metadata', {})
                    elif isinstance(result.get('metadata'), dict):
                        metadata = result['metadata']
                        url = metadata.get('source', metadata.get('url', ''))
                        title = metadata.get('title', url)
                elif hasattr(result, 'metadata') and hasattr(result, 'page_content'):
                    metadata = result.metadata
                    url = metadata.get('source', metadata.get('url', ''))
                    title = metadata.get('title', url)
                else:
                    continue
                
                # Clean the title and url
                title = str(title).strip().replace('\n', ' ').replace('"', "'") if title else ""
                url = str(url).strip() if url else ""
                
                # Avoid duplicate URLs and empty/invalid entries
                if url and url not in seen_urls and title:
                    seen_urls.add(url)
                    # Format source with proper citation style
                    sources.append(f"{i}. [{title}]({url})")
            except Exception as e:
                print(f"Error processing source {i}: {e}")
                continue
        
        if not sources:
            return ""
            
        # Create a proper sources section with a header
        return "\n\n### Sources\n" + "\n".join(sources)

    # Define analysis functions
    def analysis_node_factory(analysis_type: str):
        def analysis_node(state):
            query = f"{analysis_type} analysis of {state['input']} 2025"
            results = search_tool.invoke(query)
            
            # Create detailed instructions based on analysis type
            if analysis_type == "Porter's Five Forces":
                markdown_instructions = f"""
                Generate a comprehensive Porter's Five Forces analysis in markdown format for: {state['messages'][-1][1]}
                
                Do NOT wrap your entire response in ```markdown or ```md code blocks. 
                Write the content directly using markdown syntax.
                
                IMPORTANT: Include in-text citations using the format [X] where X is the source number (1, 2, 3, etc.).
                For example: "According to recent market research [1], the industry has shown significant growth."
                Make sure to cite sources for factual information, statistics, and specific claims.
                
                Structure your analysis with the following sections:
                
                1. # Porter's Five Forces Analysis
                
                2. ## Introduction
                   - Brief overview of the industry/company being analyzed
                   - Why this analysis is important for strategic decision-making
                
                3. ## Competitive Rivalry
                   - Assess the intensity of competition among existing firms
                   - Consider: number of competitors, industry growth rate, product differentiation, exit barriers, fixed costs
                   - Rate this force (High/Medium/Low) with justification
                
                4. ## Threat of New Entrants
                   - Evaluate how easy it is for new competitors to enter the market
                   - Consider: economies of scale, capital requirements, access to distribution, brand loyalty, regulations
                   - Rate this force (High/Medium/Low) with justification
                
                5. ## Bargaining Power of Suppliers
                   - Analyze how much leverage suppliers have in the relationship
                   - Consider: number of suppliers, uniqueness of their product/service, switching costs, forward integration
                   - Rate this force (High/Medium/Low) with justification
                
                6. ## Bargaining Power of Buyers
                   - Assess how much leverage customers have in the relationship
                   - Consider: number of buyers, purchase volume, price sensitivity, product differentiation, switching costs
                   - Rate this force (High/Medium/Low) with justification
                
                7. ## Threat of Substitutes
                   - Evaluate the availability of alternative products/services
                   - Consider: price-performance of substitutes, switching costs, buyer propensity to substitute
                   - Rate this force (High/Medium/Low) with justification
                
                8. ## Overall Assessment
                   - Summarize the findings from all five forces
                   - Provide an overall industry attractiveness rating
                   - Identify key strategic implications for businesses in this industry
                
                9. ## Strategic Recommendations
                   - Suggest 3-5 specific strategies to address the challenges and opportunities identified
                   - Make these actionable and specific to the industry context
                
                Use the following information from web searches to inform your analysis:
                {results}
                """
            elif analysis_type == "Business Model Canvas":
                markdown_instructions = f"""
                Generate a comprehensive Business Model Canvas analysis in markdown format for: {state['messages'][-1][1]}
                
                Do NOT wrap your entire response in ```markdown or ```md code blocks. 
                Write the content directly using markdown syntax.
                
                IMPORTANT: Include in-text citations using the format [X] where X is the source number (1, 2, 3, etc.).
                For example: "According to recent market research [1], the industry has shown significant growth."
                Make sure to cite sources for factual information, statistics, and specific claims.
                
                Structure your analysis with the following sections:
                
                1. # Business Model Canvas Analysis
                
                2. ## Introduction
                   - Brief overview of the company/business being analyzed
                   - Purpose and value of using the Business Model Canvas for this analysis
                
                3. ## Customer Segments
                   - Identify the different groups of people or organizations the business aims to reach and serve
                   - Analyze whether they target mass market, niche market, segmented, diversified, or multi-sided platforms
                   - Provide specific examples of customer types and their characteristics
                
                4. ## Value Propositions
                   - Describe the bundle of products and services that create value for each customer segment
                   - Analyze how the business solves customer problems or satisfies customer needs
                   - Evaluate what makes their offering unique compared to competitors
                
                5. ## Channels
                   - Identify how the company communicates with and reaches its customer segments
                   - Analyze the customer touch points (awareness, evaluation, purchase, delivery, after-sales)
                   - Evaluate the effectiveness of these channels
                
                6. ## Customer Relationships
                   - Describe the types of relationships the company establishes with specific customer segments
                   - Analyze whether they use personal assistance, dedicated personal assistance, self-service, automated services, communities, or co-creation
                   - Evaluate how these relationships integrate with the rest of the business model
                
                7. ## Revenue Streams
                   - Identify how the company generates cash from each customer segment
                   - Analyze pricing mechanisms (fixed pricing, dynamic pricing, etc.)
                   - Evaluate the sustainability and diversity of revenue streams
                
                8. ## Key Resources
                   - Describe the most important assets required to make the business model work
                   - Categorize them as physical, intellectual, human, or financial resources
                   - Analyze how these resources support the value proposition
                
                9. ## Key Activities
                   - Identify the most important things the company must do to make its business model work
                   - Categorize them as production, problem-solving, or platform/network activities
                   - Evaluate how well these activities are executed
                
                10. ## Key Partnerships
                    - Describe the network of suppliers and partners that make the business model work
                    - Analyze the types of partnerships (strategic alliances, coopetition, joint ventures, buyer-supplier relationships)
                    - Evaluate the effectiveness of these partnerships
                
                11. ## Cost Structure
                    - Describe all costs incurred to operate the business model
                    - Analyze whether the business is cost-driven or value-driven
                    - Identify fixed costs, variable costs, economies of scale, and economies of scope
                
                12. ## Strategic Insights and Recommendations
                    - Provide an overall assessment of the business model's strengths and weaknesses
                    - Identify opportunities for innovation or improvement in each of the nine building blocks
                    - Suggest 3-5 specific strategies to enhance the business model
                
                Use the following information from web searches to inform your analysis:
                {results}
                """
            else:
                # Create detailed instructions to ensure proper markdown formatting
                markdown_instructions = f"""
                Generate a comprehensive {analysis_type} analysis in markdown format using the information provided below.
                
                Do NOT wrap your entire response in ```markdown or ```md code blocks. 
                Write the content directly using markdown syntax.
                
                IMPORTANT: Include in-text citations using the format [X] where X is the source number (1, 2, 3, etc.).
                For example: "According to recent market research [1], the industry has shown significant growth."
                Make sure to cite sources for factual information, statistics, and specific claims.
                
                Follow these markdown formatting guidelines:
                1. Use # for main headings and ## or ### for subheadings
                2. Use bullet points (- or *) for lists of items
                3. Use numbered lists (1., 2., etc.) for sequential steps or prioritized items
                4. Use **bold** for emphasis on important points
                5. Use tables with | and --- syntax where appropriate for organized data
                6. Use `code` for any technical terms
                
                Structure your analysis with clear sections and proper formatting.
                
                Information for analysis:
                {results}
                """
            
            response = llm.invoke(markdown_instructions)
            sanitized_response = sanitize_markdown(response.content)
            
            # Add source links to the response
            source_links = format_source_links(results)
            final_response = sanitized_response + source_links
            
            return {"messages": state["messages"] + [("ai", final_response)]}
        return analysis_node
    
    # Define general node function
    def general_node(state):
        # Get search results for the user's input
        search_results = search_tool.invoke(state['input'])
        
        # Generate response with LLM
        response_content = sanitize_markdown(llm.invoke(
            f"""
            Respond to the user's message using proper markdown formatting.
            
            Do NOT wrap your response in ```markdown or ```md code blocks.
            Write the content directly using markdown syntax.
            
            IMPORTANT: Include in-text citations using the format [X] where X is the source number (1, 2, 3, etc.).
            For example: "According to recent market research [1], the industry has shown significant growth."
            Make sure to cite sources for factual information, statistics, and specific claims.
            
            Use these markdown elements appropriately:
            - Headings with # or ##
            - Lists with - or *
            - Emphasis with **bold** or *italic*
            - Tables with | and --- where appropriate
            
            User's message history: {state['messages']}
            Latest message: {state['input']}
            
            Here is some relevant information that might help with your response:
            {search_results}
            """
        ).content)
        
        # Add source links to the response
        source_links = format_source_links(search_results)
        final_response = response_content + source_links
        
        return {"messages": state["messages"] + [("ai", final_response)]}

    # Create nodes
    nodes = {
        "swot": analysis_node_factory("SWOT"),
        "pestle": analysis_node_factory("PESTLE"),
        "tows": analysis_node_factory("TOWS matrix"),
        "porter": analysis_node_factory("Porter's Five Forces"),
        "canvas": analysis_node_factory("Business Model Canvas"),
        "general": general_node
    }

    for name, node in nodes.items():
        workflow.add_node(name, node)

    # Configure routing
    def route_based_on_input(state):
        input_text = state["input"].lower()
        return next((key for key in nodes if key in input_text), "general")

    workflow.add_conditional_edges(
        START,
        route_based_on_input,
        {key: key for key in nodes}
    )
    
    for node in nodes:
        workflow.add_edge(node, END)

    return workflow.compile()
