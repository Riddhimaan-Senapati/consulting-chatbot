from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_google_genai import ChatGoogleGenerativeAI
import os
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

    # Define analysis functions
    def analysis_node_factory(analysis_type: str):
        def analysis_node(state):
            query = f"{analysis_type} analysis of {state['messages'][-1][1]} 2025"
            results = search_tool.invoke(query)
            response = llm.invoke(f"Generate {analysis_type} analysis in markdown using: {results}")
            return {"messages": state["messages"] + [("ai", response.content)]}
        return analysis_node

    # Create nodes
    nodes = {
        "swot": analysis_node_factory("SWOT"),
        "pestle": analysis_node_factory("PESTLE"),
        "tows": analysis_node_factory("TOWS matrix"),
        "general": lambda state: {
            "messages": state["messages"] + [("ai", llm.invoke(state['messages']).content)]
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
