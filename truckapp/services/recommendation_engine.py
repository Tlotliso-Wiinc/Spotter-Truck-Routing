import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class RecommendationEngine:
    def recommend_route(self, routes: List[Dict]) -> Dict:
        """Recommend the best route based on the criteria from spec:
        1. Fewest Severe miles
        2. Fewest High miles
        3. Lowest average risk
        4. Shortest travel times
        """
        logger.info(f"[RECOMMENDATION_ENGINE] Recommending best route from {len(routes)} routes")
        if not routes:
            logger.warning("[RECOMMENDATION_ENGINE] No routes to recommend")
            return None
        
        # Score each route
        scored_routes = []
        for route in routes:
            score = self._calculate_route_score(route)
            logger.debug(f"[RECOMMENDATION_ENGINE] Route {route['name']} score: {score:.2f}")
            scored_routes.append({
                'route': route,
                'score': score
            })
        
        # Sort by score (lower is better)
        scored_routes.sort(key=lambda x: x['score'])
        logger.debug(f"[RECOMMENDATION_ENGINE] Routes sorted by score")
        
        # Mark the recommended route
        recommended = scored_routes[0]['route']
        recommended['is_recommended'] = True
        logger.info(f"[RECOMMENDATION_ENGINE] Recommended route: {recommended['name']} (score: {scored_routes[0]['score']:.2f})")
        
        # Mark others as not recommended
        for item in scored_routes[1:]:
            item['route']['is_recommended'] = False
            logger.debug(f"[RECOMMENDATION_ENGINE] Marked {item['route']['name']} as not recommended (score: {item['score']:.2f})")
        
        return recommended
    
    def _calculate_route_score(self, route: Dict) -> float:
        """Calculate a composite score for a route"""
        risk_summary = route.get('risk_summary', {})
        risk_counts = risk_summary.get('risk_counts', {})
        logger.debug(f"[RECOMMENDATION_ENGINE] Calculating score for {route['name']} - Risk counts: {risk_counts}")
        
        # Priority 1: Fewest Severe miles (weighted highest)
        severe_count = risk_counts.get('Severe', 0)
        severe_score = severe_count * 1000
        logger.debug(f"[RECOMMENDATION_ENGINE] Severe score: {severe_score} (count: {severe_count})")
        
        # Priority 2: Fewest High miles
        high_count = risk_counts.get('High', 0)
        high_score = high_count * 100
        logger.debug(f"[RECOMMENDATION_ENGINE] High score: {high_score} (count: {high_count})")
        
        # Priority 3: Lowest average risk
        avg_risk = risk_summary.get('average_risk_score', 1)
        risk_score = avg_risk * 10
        logger.debug(f"[RECOMMENDATION_ENGINE] Risk score: {risk_score} (avg: {avg_risk:.2f})")
        
        # Priority 4: Shortest travel time
        duration = route.get('duration', 0)
        time_score = duration
        logger.debug(f"[RECOMMENDATION_ENGINE] Time score: {time_score} (duration: {duration:.2f}h)")
        
        total_score = severe_score + high_score + risk_score + time_score
        logger.debug(f"[RECOMMENDATION_ENGINE] Total score: {total_score:.2f}")
        return total_score
