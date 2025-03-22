from typing import TypedDict
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
    search_tool = TavilySearchResults(max_results=3)

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

    # Define analysis functions
    def analysis_node_factory(analysis_type: str):
        def analysis_node(state):
            query = f"{analysis_type} analysis of {state['messages'][-1][1]} 2025"
            results = search_tool.invoke(query)
            
            # Create detailed instructions to ensure proper markdown formatting
            markdown_instructions = f"""
            Generate a comprehensive {analysis_type} analysis in markdown format using the information provided below.
            
            Do NOT wrap your entire response in ```markdown or ```md code blocks. 
            Write the content directly using markdown syntax.
            
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
            return {"messages": state["messages"] + [("ai", sanitized_response)]}
        return analysis_node

    # Create nodes
    nodes = {
        "swot": analysis_node_factory("SWOT"),
        "pestle": analysis_node_factory("PESTLE"),
        "tows": analysis_node_factory("TOWS matrix"),
        "general": lambda state: {
            "messages": state["messages"] + [("ai", sanitize_markdown(llm.invoke(
                f"""
                Respond to the user's message using proper markdown formatting.
                
                Do NOT wrap your response in ```markdown or ```md code blocks.
                Write the content directly using markdown syntax.
                
                Use these markdown elements appropriately:
                - Headings with # or ##
                - Lists with - or *
                - Emphasis with **bold** or *italic*
                - Tables with | and --- where appropriate
                
                User's message history: {state['messages']}
                Latest message: {state['input']}
                """
            ).content))]
        }
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
