from typing import Dict, List


class RecommendationEngine:
    def recommend_route(self, routes: List[Dict]) -> Dict:
        """Recommend the best route based on the criteria from spec:
        1. Fewest Severe miles
        2. Fewest High miles
        3. Lowest average risk
        4. Shortest travel times
        """
        if not routes:
            return None
        
        # Score each route
        scored_routes = []
        for route in routes:
            score = self._calculate_route_score(route)
            scored_routes.append({
                'route': route,
                'score': score
            })
        
        # Sort by score (lower is better)
        scored_routes.sort(key=lambda x: x['score'])
        
        # Mark the recommended route
        recommended = scored_routes[0]['route']
        recommended['is_recommended'] = True
        
        # Mark others as not recommended
        for item in scored_routes[1:]:
            item['route']['is_recommended'] = False
        
        return recommended
    
    def _calculate_route_score(self, route: Dict) -> float:
        """Calculate a composite score for a route"""
        risk_summary = route.get('risk_summary', {})
        risk_counts = risk_summary.get('risk_counts', {})
        
        # Priority 1: Fewest Severe miles (weighted highest)
        severe_count = risk_counts.get('Severe', 0)
        severe_score = severe_count * 1000
        
        # Priority 2: Fewest High miles
        high_count = risk_counts.get('High', 0)
        high_score = high_count * 100
        
        # Priority 3: Lowest average risk
        avg_risk = risk_summary.get('average_risk_score', 1)
        risk_score = avg_risk * 10
        
        # Priority 4: Shortest travel time
        duration = route.get('duration', 0)
        time_score = duration
        
        total_score = severe_score + high_score + risk_score + time_score
        return total_score
