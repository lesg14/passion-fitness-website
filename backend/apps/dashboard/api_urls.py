from django.urls import path

from .api import (
    CsrfView,
    DashboardView,
    LoginView,
    LogoutView,
    MemberDetailView,
    MemberListCreateView,
    PaymentCreateView,
    PaymentVoidView,
    PlanDetailView,
    PlanListCreateView,
    SessionView,
)

urlpatterns = [
    path('auth/csrf/', CsrfView.as_view(), name='api-csrf'),
    path('auth/login/', LoginView.as_view(), name='api-login'),
    path('auth/session/', SessionView.as_view(), name='api-session'),
    path('auth/logout/', LogoutView.as_view(), name='api-logout'),
    path('dashboard/', DashboardView.as_view(), name='api-dashboard'),
    path('plans/', PlanListCreateView.as_view(), name='api-plans'),
    path('plans/<int:pk>/', PlanDetailView.as_view(), name='api-plan-detail'),
    path('members/', MemberListCreateView.as_view(), name='api-members'),
    path('members/<int:pk>/', MemberDetailView.as_view(), name='api-member-detail'),
    path('payments/', PaymentCreateView.as_view(), name='api-payments'),
    path('payments/<int:pk>/void/', PaymentVoidView.as_view(), name='api-payment-void'),
]