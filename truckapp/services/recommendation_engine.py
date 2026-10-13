import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class RecommendationEngine:
    def recommend_route(self, routes: List[Dict]) -> Optional[Dict]:
        """
        Recommend the best route based on the criteria from spec.md:
        Prefer:
        1. Fewest Severe miles (and No Travel)
        2. Fewest High miles
        3. Lowest average risk
        4. Shortest travel times
        """
        logger.info(f"[RECOMMENDATION_ENGINE] Recommending best route from {len(routes)} routes")
        if not routes:
            logger.warning("[RECOMMENDATION_ENGINE] No routes to recommend")
            return None
        
        # Helper to extract sorting key matching spec priority:
        # (no_travel_count, severe_count, high_count, average_risk_score, duration)
        def route_rank_key(route: Dict):
            risk_summary = route.get('risk_summary', {})
            risk_counts = risk_summary.get('risk_counts', {})
            no_travel = risk_counts.get('No Travel', 0)
            severe = risk_counts.get('Severe', 0)
            high = risk_counts.get('High', 0)
            avg_risk = risk_summary.get('average_risk_score', 1.0)
            duration = route.get('duration', 0.0)
            return (no_travel, severe, high, avg_risk, duration)
        
        # Sort routes by rank criteria (lowest is best)
        sorted_routes = sorted(routes, key=route_rank_key)
        
        recommended = sorted_routes[0]
        for route in routes:
            route['is_recommended'] = (route.get('route_id') == recommended.get('route_id'))
        
        logger.info(f"[RECOMMENDATION_ENGINE] Recommended route: {recommended.get('name')} (ID: {recommended.get('route_id')})")
        return recommended
